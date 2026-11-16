/** Finite regression tests of the shipped implementation, not a proof of refinement. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractError, TaskManagerState, mkTask, invTask, invTaskBoard,
  validTransition, filterByStatus, filterByPriority, countByStatus, getAssignedTasks,
  type Status, type Priority,
} from "./task-manager";

test("create, update, transition, query, delete use the actual implementation", () => {
  const manager = new TaskManagerState();
  const first = manager.createTask("Design API", "Endpoints", "High", "Alice");
  const second = manager.createTask("Write tests", "", "Medium", "Bob");
  const third = manager.createTask("Set up CI", "", "Low", null);
  assert.deepEqual([first, second, third, manager.nextId], [1, 2, 3, 4]);
  manager.changeStatus(first, "InProgress");
  manager.updateTask(first, "Design contracts", "Updated", "Low", "Bob");
  assert.deepEqual(manager.board.get(first), {
    id: 1, title: "Design contracts", desc: "Updated", status: "InProgress", priority: "Low", assignee: "Bob",
  });
  manager.changeStatus(first, "Done");
  assert.deepEqual(manager.getSummary(), [2, 0, 1]);
  assert.deepEqual([...filterByStatus(manager.board, "Todo")].map(t => t.id), [2, 3]);
  assert.deepEqual([...filterByPriority(manager.board, "Low")].map(t => t.id), [1, 3]);
  assert.deepEqual([...getAssignedTasks(manager.board, "Bob")].map(t => t.id), [1, 2]);
  assert.equal(countByStatus(manager.board, "Done"), 1);
  manager.deleteTask(third);
  assert.equal(manager.board.has(third), false);
  assert.deepEqual(manager.getSummary(), [1, 0, 1]);
  assert.equal(manager.createTask("Next task", "", "Low", null), 4);
});

for (const badId of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`nat1 representation rejects ${String(badId)}`, () => {
    assert.throws(() => mkTask(badId, "Task", "", "Todo", "Low", null), ContractError);
    assert.equal(invTask({ id: badId, title: "Task", desc: "", status: "Todo", priority: "Low", assignee: null }), false);
  });
}

test("record boundaries and optional nonempty assignee are enforced", () => {
  assert.ok(invTask(mkTask(Number.MAX_SAFE_INTEGER, "x".repeat(100), "y".repeat(500), "Todo", "High", "A")));
  for (const [title, desc, assignee] of [["", "", null], ["x".repeat(101), "", null], ["Task", "y".repeat(501), null], ["Task", "", ""]] as const) {
    assert.throws(() => mkTask(1, title, desc, "Todo", "Low", assignee), ContractError);
  }
  assert.throws(() => mkTask(1, "Task", "", "Unknown" as Status, "Low", null), ContractError);
  assert.throws(() => mkTask(1, "Task", "", "Todo", "Unknown" as Priority, null), ContractError);
  assert.throws(() => getAssignedTasks(new Map(), ""), ContractError);
});

for (const from of ["Todo", "InProgress", "Done"] as const) {
  for (const to of ["Todo", "InProgress", "Done"] as const) {
    test(`transition ${from} -> ${to}`, () => {
      const manager = new TaskManagerState();
      const id = manager.createTask("Task", "Description", "High", "Alice");
      manager.changeStatus(id, from);
      const before = manager.board.get(id)!;
      const allowed = from !== "Done" || to === "Done";
      assert.equal(validTransition(from, to), allowed);
      if (allowed) {
        manager.changeStatus(id, to);
        assert.deepEqual(manager.board.get(id), { ...before, status: to });
      } else {
        assert.throws(() => manager.changeStatus(id, to), ContractError);
        assert.deepEqual(manager.board.get(id), before);
      }
    });
  }
}

test("invalid writes leave both board and nextId unchanged", () => {
  const manager = new TaskManagerState();
  const id = manager.createTask("Task", "", "Low", null);
  const before = manager.board;
  const nextId = manager.nextId;
  const failures = [
    () => manager.createTask("", "", "Low", null),
    () => manager.createTask("Task", "", "Unknown" as Priority, null),
    () => manager.createTask("Task", "", "Low", ""),
    () => manager.updateTask(id, "", "", "Low", null),
    () => manager.updateTask(id, "Task", "x".repeat(501), "Low", null),
    () => manager.updateTask(id, "Task", "", "Unknown" as Priority, null),
    () => manager.updateTask(999, "Task", "", "Low", null),
    () => manager.changeStatus(id, "Unknown" as Status),
    () => manager.changeStatus(999, "Done"),
    () => manager.deleteTask(999),
  ];
  for (const fail of failures) {
    assert.throws(fail, ContractError);
    assert.deepEqual(manager.board, before);
    assert.equal(manager.nextId, nextId);
  }
});

test("board invariant checks nested task constraints and key identity", () => {
  const good = mkTask(1, "Task", "", "Todo", "Low", null);
  assert.ok(invTaskBoard(new Map([[1, good]])));
  assert.equal(invTaskBoard(new Map([[2, good]])), false);
  assert.equal(invTaskBoard(new Map([[1, { ...good, title: "" }]])), false);
});

test("read access cannot mutate manager state or returned task values", () => {
  const manager = new TaskManagerState();
  const id = manager.createTask("Task", "", "Low", null);
  const snapshot = manager.board;
  snapshot.clear();
  assert.equal(manager.board.size, 1);
  const task = [...filterByStatus(manager.board, "Todo")][0];
  assert.equal(Reflect.set(task, "title", ""), false);
  assert.equal(Reflect.set(manager, "nextId", 0), false);
  assert.equal(manager.board.get(id)!.title, "Task");
  assert.deepEqual(manager.getSummary(), [1, 0, 0]);
});

test("query functions reject invalid enum values and invalid nested records", () => {
  const good = mkTask(1, "Task", "", "Todo", "Low", "Alice");
  const board = new Map([[1, good]]);
  assert.throws(() => filterByStatus(board, "Unknown" as Status), ContractError);
  assert.throws(() => countByStatus(board, "Unknown" as Status), ContractError);
  assert.throws(() => filterByPriority(board, "Unknown" as Priority), ContractError);
  const invalidBoard = new Map([[1, { ...good, title: "" }]]);
  assert.throws(() => filterByStatus(invalidBoard, "Todo"), ContractError);
  assert.throws(() => filterByPriority(invalidBoard, "Low"), ContractError);
  assert.throws(() => countByStatus(invalidBoard, "Todo"), ContractError);
  assert.throws(() => getAssignedTasks(invalidBoard, "Alice"), ContractError);
});

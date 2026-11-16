// Contract tests for TaskManager.vdmsl (module TaskManager, state TaskStore).
// The tests import the generated implementation; they do not re-implement it.
import { describe, it, expect } from 'vitest';
import {
  TaskStore,
  ContractError,
  invTitle,
  mkTitle,
  isValidTaskId,
  isTaskStatus,
  TASK_STATUS_VALUES,
  invTask,
  mkTask,
} from '../generated/index.ts';
import type { Task, TaskId, TaskStatus } from '../generated/index.ts';

const ALL_STATUSES: readonly TaskStatus[] = ['Todo', 'InProgress', 'Done'];

/** Copy of the state as seen through the read-only accessors (tasks~, nextId~). */
function snapshot(store: TaskStore): { tasks: Map<TaskId, Task>; nextId: TaskId } {
  return { tasks: new Map(store.tasks), nextId: store.nextId };
}

// ============================================
// テストスイート1：型の制約と不変式
// ============================================

describe('TaskManager - Type Invariants', () => {
  describe('Title (seq1 of char, inv: len t <= 100)', () => {
    it('accepts a 1-character title (lower boundary, seq1)', () => {
      expect(invTitle('a')).toBe(true);
      expect(mkTitle('a')).toBe('a');
    });

    it('accepts a 100-character title (upper boundary, inv)', () => {
      const t = 'a'.repeat(100);
      expect(invTitle(t)).toBe(true);
      expect(mkTitle(t)).toBe(t);
    });

    it('rejects an empty title (below the lower boundary, seq1)', () => {
      expect(invTitle('')).toBe(false);
      expect(() => mkTitle('')).toThrow(ContractError);
    });

    it('rejects a 101-character title (above the upper boundary, inv)', () => {
      const t = 'a'.repeat(101);
      expect(invTitle(t)).toBe(false);
      expect(() => mkTitle(t)).toThrow(ContractError);
    });

    it('counts Japanese characters in the BMP as 1 each (100 accepted, 101 rejected)', () => {
      expect(invTitle('あ'.repeat(100))).toBe(true);
      expect(invTitle('あ'.repeat(101))).toBe(false);
    });

    it('counts UTF-16 code units: an emoji counts as 2 (50 accepted, 51 rejected)', () => {
      expect(invTitle('😀'.repeat(50))).toBe(true);
      expect(invTitle('😀'.repeat(51))).toBe(false);
    });
  });

  describe('TaskId (nat1)', () => {
    it('accepts 1 (lower boundary)', () => {
      expect(isValidTaskId(1)).toBe(true);
    });

    it('rejects 0 and negative numbers', () => {
      expect(isValidTaskId(0)).toBe(false);
      expect(isValidTaskId(-1)).toBe(false);
    });

    it('rejects non-integers, NaN and Infinity', () => {
      expect(isValidTaskId(1.5)).toBe(false);
      expect(isValidTaskId(Number.NaN)).toBe(false);
      expect(isValidTaskId(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('is limited to the safe-integer range (representation difference)', () => {
      expect(isValidTaskId(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isValidTaskId(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    });
  });

  describe('TaskStatus (<Todo> | <InProgress> | <Done>)', () => {
    it('has exactly the three values of the spec', () => {
      expect([...TASK_STATUS_VALUES]).toEqual(['Todo', 'InProgress', 'Done']);
    });

    ALL_STATUSES.forEach((status) => {
      it(`accepts ${status}`, () => {
        expect(isTaskStatus(status)).toBe(true);
      });
    });

    it('rejects values outside the type', () => {
      expect(isTaskStatus('Cancelled')).toBe(false);
      expect(isTaskStatus('todo')).toBe(false);
      expect(isTaskStatus('')).toBe(false);
      expect(isTaskStatus(null)).toBe(false);
    });
  });

  describe('Task record (id : TaskId, title : Title, status : TaskStatus)', () => {
    it('mkTask builds a record with the given fields', () => {
      const t = mkTask(1, 'Buy milk', 'Todo');
      expect(t).toEqual({ id: 1, title: 'Buy milk', status: 'Todo' });
      expect(invTask(t)).toBe(true);
    });

    it('mkTask rejects an id that is not a nat1', () => {
      expect(() => mkTask(0, 'Buy milk', 'Todo')).toThrow(ContractError);
      expect(invTask({ id: 0, title: 'Buy milk', status: 'Todo' })).toBe(false);
    });

    it('mkTask rejects a title that breaks the Title invariant', () => {
      expect(() => mkTask(1, '', 'Todo')).toThrow(ContractError);
      expect(() => mkTask(1, 'a'.repeat(101), 'Todo')).toThrow(ContractError);
      expect(invTask({ id: 1, title: 'a'.repeat(101), status: 'Todo' })).toBe(false);
    });

    it('mkTask rejects a status outside TaskStatus', () => {
      expect(() => mkTask(1, 'Buy milk', 'Cancelled' as TaskStatus)).toThrow(ContractError);
    });
  });
});

// ============================================
// テストスイート2：初期状態（init）
// ============================================

describe('TaskStore - Initial State', () => {
  it('init: tasks = {|->} and nextId = 1', () => {
    const store = new TaskStore();
    expect(store.tasks.size).toBe(0);
    expect(store.nextId).toBe(1);
    expect(store.listTasks()).toEqual([]);
  });

  it('each instance has its own state', () => {
    const a = new TaskStore();
    const b = new TaskStore();
    a.createTask('only in a');
    expect(a.tasks.size).toBe(1);
    expect(b.tasks.size).toBe(0);
    expect(b.nextId).toBe(1);
  });
});

// ============================================
// テストスイート3：事前条件（受け付ける条件）
// ============================================

describe('TaskStore - Preconditions', () => {
  describe('createTask(title): argument must be a Title (1 to 100 characters)', () => {
    it('accepts a 1-character title and a 100-character title', () => {
      const store = new TaskStore();
      expect(() => store.createTask('a')).not.toThrow();
      expect(() => store.createTask('a'.repeat(100))).not.toThrow();
      expect(store.tasks.size).toBe(2);
    });

    it('rejects an empty title with ContractError and leaves the state unchanged', () => {
      const store = new TaskStore();
      store.createTask('existing');
      const before = snapshot(store);

      expect(() => store.createTask('')).toThrow(ContractError);

      expect(snapshot(store)).toEqual(before);
    });

    it('rejects a 101-character title with ContractError and leaves the state unchanged', () => {
      const store = new TaskStore();
      store.createTask('existing');
      const before = snapshot(store);

      expect(() => store.createTask('a'.repeat(101))).toThrow(ContractError);
      expect(() => store.createTask('a'.repeat(101))).toThrow(/title must be 1 to 100 characters/);

      expect(snapshot(store)).toEqual(before);
    });

    it('allows two tasks with the same title (no uniqueness condition in the spec)', () => {
      const store = new TaskStore();
      const first = store.createTask('same');
      const second = store.createTask('same');
      expect(second).not.toBe(first);
      expect(store.tasks.size).toBe(2);
    });
  });

  describe('changeStatus(id, newStatus) precondition: id in set dom tasks', () => {
    it('succeeds for an existing task', () => {
      const store = new TaskStore();
      const id = store.createTask('write report');
      expect(() => store.changeStatus(id, 'InProgress')).not.toThrow();
    });

    it('throws ContractError for a task that does not exist and leaves the state unchanged', () => {
      const store = new TaskStore();
      store.createTask('write report');
      const before = snapshot(store);

      expect(() => store.changeStatus(999, 'Done')).toThrow(ContractError);
      expect(() => store.changeStatus(999, 'Done')).toThrow(/id 999 not in dom tasks/);

      expect(snapshot(store)).toEqual(before);
    });

    it('throws ContractError on an empty store', () => {
      const store = new TaskStore();
      expect(() => store.changeStatus(1, 'Done')).toThrow(ContractError);
      expect(store.tasks.size).toBe(0);
      expect(store.nextId).toBe(1);
    });

    it('throws ContractError for a task that was deleted', () => {
      const store = new TaskStore();
      const id = store.createTask('write report');
      store.deleteTask(id);
      const before = snapshot(store);

      expect(() => store.changeStatus(id, 'Done')).toThrow(ContractError);

      expect(snapshot(store)).toEqual(before);
    });

    it('rejects a status outside TaskStatus with ContractError and leaves the state unchanged', () => {
      const store = new TaskStore();
      const id = store.createTask('write report');
      const before = snapshot(store);

      expect(() => store.changeStatus(id, 'Cancelled' as TaskStatus)).toThrow(ContractError);

      expect(snapshot(store)).toEqual(before);
    });
  });

  describe('deleteTask(id) precondition: id in set dom tasks', () => {
    it('succeeds for an existing task', () => {
      const store = new TaskStore();
      const id = store.createTask('write report');
      expect(() => store.deleteTask(id)).not.toThrow();
    });

    it('throws ContractError for a task that does not exist and leaves the state unchanged', () => {
      const store = new TaskStore();
      store.createTask('write report');
      const before = snapshot(store);

      expect(() => store.deleteTask(999)).toThrow(ContractError);
      expect(() => store.deleteTask(999)).toThrow(/Pre-condition failed: id 999 not in dom tasks/);

      expect(snapshot(store)).toEqual(before);
    });

    it('throws ContractError on an empty store', () => {
      const store = new TaskStore();
      expect(() => store.deleteTask(1)).toThrow(ContractError);
      expect(store.tasks.size).toBe(0);
      expect(store.nextId).toBe(1);
    });

    it('throws ContractError when the same task is deleted twice', () => {
      const store = new TaskStore();
      const id = store.createTask('write report');
      store.deleteTask(id);
      const before = snapshot(store);

      expect(() => store.deleteTask(id)).toThrow(ContractError);

      expect(snapshot(store)).toEqual(before);
    });
  });
});

// ============================================
// テストスイート4：事後条件（保証すること）
// ============================================

describe('TaskStore - Postconditions', () => {
  describe('createTask(title)', () => {
    it('RESULT = nextId~ (the first id is 1, then 2, 3)', () => {
      const store = new TaskStore();
      expect(store.createTask('first')).toBe(1);
      expect(store.createTask('second')).toBe(2);
      expect(store.createTask('third')).toBe(3);
    });

    it('RESULT = nextId~ and nextId = nextId~ + 1', () => {
      const store = new TaskStore();
      store.createTask('first');
      const before = snapshot(store);

      const id = store.createTask('second');

      expect(id).toBe(before.nextId);
      expect(store.nextId).toBe(before.nextId + 1);
    });

    it('tasks = tasks~ munion {RESULT |-> mk_Task(RESULT, title, <Todo>)}', () => {
      const store = new TaskStore();
      const first = store.createTask('first');
      store.changeStatus(first, 'Done');
      const before = snapshot(store);

      const id = store.createTask('second');

      const expected = new Map(before.tasks);
      expected.set(id, { id, title: 'second', status: 'Todo' });
      expect(new Map(store.tasks)).toEqual(expected);
    });

    it('a new task starts as Todo and keeps its title', () => {
      const store = new TaskStore();
      const id = store.createTask('タスクのタイトル');
      expect(store.tasks.get(id)).toEqual({ id, title: 'タスクのタイトル', status: 'Todo' });
    });
  });

  describe('changeStatus(id, newStatus)', () => {
    it('tasks = tasks~ ++ {id |-> mu(tasks~(id), status |-> newStatus)}: only the status of that task changes', () => {
      const store = new TaskStore();
      const a = store.createTask('a');
      const b = store.createTask('b');
      const c = store.createTask('c');
      const before = snapshot(store);

      store.changeStatus(b, 'InProgress');

      const expected = new Map(before.tasks);
      expected.set(b, { id: b, title: 'b', status: 'InProgress' });
      expect(new Map(store.tasks)).toEqual(expected);
      expect(store.tasks.get(a)).toEqual(before.tasks.get(a));
      expect(store.tasks.get(c)).toEqual(before.tasks.get(c));
    });

    it('nextId = nextId~', () => {
      const store = new TaskStore();
      const id = store.createTask('a');
      const before = snapshot(store);

      store.changeStatus(id, 'Done');

      expect(store.nextId).toBe(before.nextId);
    });

    // どの状態からどの状態へも変更してよい（同じ状態への変更も含む 3 x 3 = 9 通り）
    ALL_STATUSES.forEach((current) => {
      ALL_STATUSES.forEach((next) => {
        it(`allows ${current} -> ${next}`, () => {
          const store = new TaskStore();
          const id = store.createTask('a');
          store.changeStatus(id, current);
          expect(store.tasks.get(id)!.status).toBe(current);

          store.changeStatus(id, next);

          expect(store.tasks.get(id)).toEqual({ id, title: 'a', status: next });
        });
      });
    });
  });

  describe('deleteTask(id)', () => {
    it('tasks = {id} <-: tasks~: only that task disappears', () => {
      const store = new TaskStore();
      store.createTask('a');
      const b = store.createTask('b');
      store.createTask('c');
      const before = snapshot(store);

      store.deleteTask(b);

      const expected = new Map(before.tasks);
      expected.delete(b);
      expect(new Map(store.tasks)).toEqual(expected);
      expect(store.tasks.has(b)).toBe(false);
      expect(store.tasks.size).toBe(before.tasks.size - 1);
    });

    it('nextId = nextId~', () => {
      const store = new TaskStore();
      const id = store.createTask('a');
      const before = snapshot(store);

      store.deleteTask(id);

      expect(store.nextId).toBe(before.nextId);
    });

    it('a deleted id is not reused, even when the newest task is deleted', () => {
      const store = new TaskStore();
      store.createTask('a');
      const newest = store.createTask('b');
      store.deleteTask(newest);

      expect(store.createTask('c')).toBe(newest + 1);
      expect(store.tasks.has(newest)).toBe(false);
    });

    it('a deleted id is not reused after every task is deleted', () => {
      const store = new TaskStore();
      const a = store.createTask('a');
      const b = store.createTask('b');
      store.deleteTask(a);
      store.deleteTask(b);

      expect(store.tasks.size).toBe(0);
      expect(store.createTask('c')).toBe(3);
    });
  });

  describe('listTasks()', () => {
    it('elems RESULT = rng tasks and len RESULT = card dom tasks', () => {
      const store = new TaskStore();
      const a = store.createTask('a');
      const b = store.createTask('b');
      const c = store.createTask('c');
      store.changeStatus(b, 'Done');

      const result = store.listTasks();

      expect(result).toHaveLength(store.tasks.size);
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { id: a, title: 'a', status: 'Todo' },
        { id: b, title: 'b', status: 'Done' },
        { id: c, title: 'c', status: 'Todo' },
      ]);
      for (const task of result) {
        expect(store.tasks.get(task.id)).toEqual(task);
      }
    });

    it('returns the tasks in ascending id order, also after deletes and status changes', () => {
      const store = new TaskStore();
      store.createTask('a'); // 1
      store.createTask('b'); // 2
      store.createTask('c'); // 3
      store.changeStatus(1, 'InProgress');
      store.deleteTask(2);
      store.createTask('d'); // 4
      store.changeStatus(1, 'Done');

      const result = store.listTasks();

      expect(result.map((t) => t.id)).toEqual([1, 3, 4]);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].id).toBeLessThan(result[i].id);
      }
    });

    it('tasks = tasks~ and nextId = nextId~: listing does not change the state', () => {
      const store = new TaskStore();
      store.createTask('a');
      store.createTask('b');
      const before = snapshot(store);

      store.listTasks();
      store.listTasks();

      expect(snapshot(store)).toEqual(before);
    });

    it('changing the returned array does not change the state', () => {
      const store = new TaskStore();
      store.createTask('a');
      const before = snapshot(store);

      const result = store.listTasks();
      result.pop();

      expect(snapshot(store)).toEqual(before);
      expect(store.listTasks()).toHaveLength(1);
    });
  });
});

// ============================================
// テストスイート5：状態の不変式
// ============================================

describe('TaskStore - State Invariant', () => {
  it('holds after a sequence of operations: tasks(id).id = id and id < nextId', () => {
    const store = new TaskStore();
    const check = (): void => {
      for (const [id, task] of store.tasks) {
        expect(task.id).toBe(id);
        expect(id).toBeLessThan(store.nextId);
        expect(invTask(task)).toBe(true);
      }
    };

    check();
    const a = store.createTask('a');
    check();
    const b = store.createTask('b');
    check();
    store.changeStatus(a, 'InProgress');
    check();
    store.deleteTask(b);
    check();
    store.createTask('c');
    check();
    store.deleteTask(a);
    check();
    store.listTasks();
    check();
  });

  it('still holds after rejected calls', () => {
    const store = new TaskStore();
    store.createTask('a');

    expect(() => store.deleteTask(42)).toThrow(ContractError);
    expect(() => store.changeStatus(42, 'Done')).toThrow(ContractError);
    expect(() => store.createTask('')).toThrow(ContractError);

    for (const [id, task] of store.tasks) {
      expect(task.id).toBe(id);
      expect(id).toBeLessThan(store.nextId);
    }
    expect(store.nextId).toBe(2);
  });
});

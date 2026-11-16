// task-manager.ts — state and operations (generated from TaskManager.vdmsl, module TaskManager)
import { assert, contractsEnabled, vdmEquals } from './contracts.ts';
import { invTitle, isTaskStatus, isValidTaskId, mkTask } from './types.ts';
import type { Task, TaskId, TaskStatus, Title } from './types.ts';

/**
 * VDM-SL State: TaskStore
 *   state TaskStore of
 *     tasks  : map TaskId to Task
 *     nextId : TaskId
 *   inv mk_TaskStore(tasks, nextId) ==
 *     forall id in set dom tasks & tasks(id).id = id and id < nextId
 *   init s == s = mk_TaskStore({|->}, 1)
 *   end
 *
 * Representation differences / 仕様との表現上の差異:
 * - nextId は number。Number.MAX_SAFE_INTEGER を超えると不変条件のチェックで失敗する
 *   （VDM-SL の nat1 に上限は無い）。
 * - 本体の実行後に状態不変条件または事後条件が失敗しても、状態は巻き戻さない（変更されたまま残る）。
 * - tasks アクセサは内部の Map を ReadonlyMap 型で返す（コピーではない）。型の上だけの保護で、
 *   キャストして書き換えれば不変条件を通らずに状態が変わる。
 */
export class TaskStore {
  private _tasks: Map<TaskId, Task>;
  private _nextId: TaskId;

  constructor() {
    // init s == s = mk_TaskStore({|->}, 1)
    this._tasks = new Map();
    this._nextId = 1;
    this.checkInvariant();
  }

  /**
   * State invariant / 状態不変条件
   * forall id in set dom tasks & tasks(id).id = id and id < nextId
   */
  private checkInvariant(): void {
    if (!contractsEnabled()) return;
    assert(
      isValidTaskId(this._nextId),
      `State invariant violated: nextId ${this._nextId} is not a nat1 (safe integer >= 1)`
    );
    for (const id of this._tasks.keys()) {
      assert(
        this._tasks.get(id)!.id === id,
        `State invariant violated: tasks(${id}).id = ${this._tasks.get(id)!.id}, expected ${id}`
      );
      assert(
        id < this._nextId,
        `State invariant violated: id ${id} in dom tasks is not below nextId ${this._nextId}`
      );
    }
  }

  /** Read-only accessor / 読み取り専用 */
  get tasks(): ReadonlyMap<TaskId, Task> { return this._tasks; }
  get nextId(): TaskId { return this._nextId; }

  /**
   * VDM-SL Operation: CreateTask : Title ==> TaskId
   * タスク作成。IDは nextId から発行し、作成直後のステータスは Todo（未着手）。
   * @pre （明示的な事前条件なし。引数 title は Title 型：1文字以上100文字以下）
   * @post RESULT = nextId~ and
   *       nextId = nextId~ + 1 and
   *       tasks = tasks~ munion {RESULT |-> mk_Task(RESULT, title, <Todo>)}
   */
  createTask(title: Title): TaskId {
    const checking = contractsEnabled();

    // Pre-condition (checked before anything is changed): argument type Title
    if (checking) {
      assert(
        invTitle(title),
        `Pre-condition failed: title must be 1 to 100 characters (Title), got length ${typeof title === 'string' ? title.length : typeof title}`
      );
    }

    // Old-state snapshot for the post-condition (tasks~, nextId~)
    const tasksOld = checking ? new Map(this._tasks) : undefined;
    const nextIdOld = this._nextId;

    // Implementation: atomic( tasks := tasks munion {...}; nextId := nextId + 1 )
    const id = this._nextId;
    this._tasks.set(id, mkTask(id, title, 'Todo'));
    this._nextId = this._nextId + 1;

    // State invariant check (once, after the atomic block)
    this.checkInvariant();

    // Post-condition
    if (tasksOld !== undefined) {
      assert(id === nextIdOld, `Post-condition failed: RESULT = nextId~ (RESULT ${id}, nextId~ ${nextIdOld})`);
      assert(
        this._nextId === nextIdOld + 1,
        `Post-condition failed: nextId = nextId~ + 1 (nextId ${this._nextId}, nextId~ ${nextIdOld})`
      );
      const expected = new Map<TaskId, Task>([...tasksOld, [id, mkTask(id, title, 'Todo')]]);
      assert(
        vdmEquals(this._tasks, expected),
        'Post-condition failed: tasks = tasks~ munion {RESULT |-> mk_Task(RESULT, title, <Todo>)}'
      );
    }

    return id;
  }

  /**
   * VDM-SL Operation: ChangeStatus : TaskId * TaskStatus ==> ()
   * ステータス変更。どの状態からどの状態へも変更してよい。
   * @pre id in set dom tasks
   * @post tasks = tasks~ ++ {id |-> mu(tasks~(id), status |-> newStatus)} and
   *       nextId = nextId~
   */
  changeStatus(id: TaskId, newStatus: TaskStatus): void {
    const checking = contractsEnabled();

    // Pre-condition (checked before anything is changed)
    if (checking) {
      assert(
        isTaskStatus(newStatus),
        `Pre-condition failed: newStatus ${String(newStatus)} is not a TaskStatus (Todo | InProgress | Done)`
      );
      assert(this._tasks.has(id), `Pre-condition failed: id ${String(id)} not in dom tasks`);
    }

    // Old-state snapshot (tasks~, nextId~)
    const tasksOld = checking ? new Map(this._tasks) : undefined;
    const nextIdOld = this._nextId;

    // Implementation: tasks := tasks ++ {id |-> mu(tasks(id), status |-> newStatus)}
    const current = this._tasks.get(id)!;
    this._tasks = new Map<TaskId, Task>([
      ...this._tasks,
      [id, mkTask(current.id, current.title, newStatus)],
    ]);

    // State invariant check
    this.checkInvariant();

    // Post-condition
    if (tasksOld !== undefined) {
      const old = tasksOld.get(id)!;
      const expected = new Map<TaskId, Task>([
        ...tasksOld,
        [id, mkTask(old.id, old.title, newStatus)],
      ]);
      assert(
        vdmEquals(this._tasks, expected),
        'Post-condition failed: tasks = tasks~ ++ {id |-> mu(tasks~(id), status |-> newStatus)}'
      );
      assert(this._nextId === nextIdOld, 'Post-condition failed: nextId = nextId~');
    }
  }

  /**
   * VDM-SL Operation: DeleteTask : TaskId ==> ()
   * 削除。存在するタスクだけ削除できる。
   * @pre id in set dom tasks
   * @post tasks = {id} <-: tasks~ and nextId = nextId~
   */
  deleteTask(id: TaskId): void {
    const checking = contractsEnabled();

    // Pre-condition (checked before anything is changed)
    if (checking) {
      assert(this._tasks.has(id), `Pre-condition failed: id ${String(id)} not in dom tasks`);
    }

    // Old-state snapshot (tasks~, nextId~)
    const tasksOld = checking ? new Map(this._tasks) : undefined;
    const nextIdOld = this._nextId;

    // Implementation: tasks := {id} <-: tasks
    this._tasks.delete(id);

    // State invariant check
    this.checkInvariant();

    // Post-condition
    if (tasksOld !== undefined) {
      const expected = new Map(tasksOld);
      expected.delete(id);
      assert(vdmEquals(this._tasks, expected), 'Post-condition failed: tasks = {id} <-: tasks~');
      assert(this._nextId === nextIdOld, 'Post-condition failed: nextId = nextId~');
    }
  }

  /**
   * VDM-SL Operation: ListTasks : () ==> seq of Task
   * 一覧取得（ID昇順）。状態は変えない。
   * @post elems RESULT = rng tasks and
   *       len RESULT = card dom tasks and
   *       (forall i in set inds RESULT & i > 1 => RESULT(i - 1).id < RESULT(i).id) and
   *       tasks = tasks~ and nextId = nextId~
   *
   * Representation difference / 仕様との表現上の差異:
   * 戻り値は毎回新しい配列だが、要素の Task オブジェクトは状態が持っているものと同じ参照（コピーではない）。
   */
  listTasks(): Task[] {
    const checking = contractsEnabled();

    // Old-state snapshot (tasks~, nextId~)
    const tasksOld = checking ? new Map(this._tasks) : undefined;
    const nextIdOld = this._nextId;

    // Implementation: return [tasks(id) | id in set dom tasks]  (ascending id)
    const result: Task[] = [...this._tasks.keys()]
      .sort((a, b) => a - b)
      .map(id => this._tasks.get(id)!);

    // State invariant check
    this.checkInvariant();

    // Post-condition
    if (tasksOld !== undefined) {
      assert(
        vdmEquals(new Set(result), new Set(this._tasks.values())),
        'Post-condition failed: elems RESULT = rng tasks'
      );
      assert(
        result.length === this._tasks.size,
        `Post-condition failed: len RESULT = card dom tasks (len ${result.length}, card ${this._tasks.size})`
      );
      assert(
        result
          .map((_, k) => k + 1)
          .every(i => !(i > 1) || result[i - 2].id < result[i - 1].id),
        'Post-condition failed: forall i in set inds RESULT & i > 1 => RESULT(i - 1).id < RESULT(i).id'
      );
      assert(vdmEquals(this._tasks, tasksOld), 'Post-condition failed: tasks = tasks~');
      assert(this._nextId === nextIdOld, 'Post-condition failed: nextId = nextId~');
    }

    return result;
  }
}

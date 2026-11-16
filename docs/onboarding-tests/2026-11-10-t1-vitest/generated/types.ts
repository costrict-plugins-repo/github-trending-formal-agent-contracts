// types.ts — type definitions (generated from TaskManager.vdmsl)
import { ContractError } from './contracts.ts';

/**
 * VDM-SL: TaskId = nat1
 *
 * Representation difference / 仕様との表現上の差異:
 * VDM-SL の nat1 は上限の無い正の整数。ここでは number で表し、
 * 安全な整数の範囲（1 〜 Number.MAX_SAFE_INTEGER）に限る。
 */
export type TaskId = number;

export function isValidTaskId(id: number): boolean {
  return Number.isSafeInteger(id) && id >= 1;
}

/** VDM-SL: TaskStatus = <Todo> | <InProgress> | <Done>（未着手／進行中／完了） */
export type TaskStatus = 'Todo' | 'InProgress' | 'Done';

/** Runtime list of the values / 実行時に値を列挙するための配列 */
export const TASK_STATUS_VALUES: readonly TaskStatus[] = ['Todo', 'InProgress', 'Done'];

export function isTaskStatus(x: unknown): x is TaskStatus {
  return TASK_STATUS_VALUES.includes(x as TaskStatus);
}

/**
 * VDM-SL: Title = seq1 of char
 *         inv t == len t <= 100
 *
 * Representation difference / 仕様との表現上の差異:
 * 長さは string の length（UTF-16 のコード単位）で数える。BMP 外の文字（多くの絵文字、
 * 𠮷 など一部の漢字）は1文字が 2 と数えられる（VDMJ 4.7.0 の len も同じ数え方）。
 */
export type Title = string;

/** Invariant: Title / 不変条件（1文字以上100文字以下） */
export function invTitle(t: string): boolean {
  return typeof t === 'string' && t.length > 0 && t.length <= 100;
}

/** Factory: Title / ファクトリ関数（常に不変条件をチェックする） */
export function mkTitle(t: string): Title {
  if (!invTitle(t)) {
    throw new ContractError(
      `Title invariant violated: length must be 1..100, got ${typeof t === 'string' ? t.length : typeof t}`
    );
  }
  return t;
}

/**
 * VDM-SL Record: Task
 *   Task ::
 *     id     : TaskId
 *     title  : Title
 *     status : TaskStatus
 *
 * Representation difference / 仕様との表現上の差異:
 * VDM-SL のレコードは値として比較される（=）。ここではオブジェクトなので === は同一性の比較になる。
 * 値として比べるときは vdmEquals を使う。readonly は型の上だけの保護で、実行時に凍結はしていない。
 */
export interface Task {
  readonly id: TaskId;
  readonly title: Title;
  readonly status: TaskStatus;
}

/** Invariant: Task / 不変条件（各フィールドの型の制約） */
export function invTask(t: Task): boolean {
  return isValidTaskId(t.id)
    && invTitle(t.title)
    && isTaskStatus(t.status);
}

/** Factory: mk_Task / ファクトリ関数（常に不変条件をチェックする） */
export function mkTask(id: TaskId, title: Title, status: TaskStatus): Task {
  const t: Task = { id, title, status };
  if (!invTask(t)) {
    throw new ContractError(
      `Task invariant violated: id=${String(id)}, title length=${typeof title === 'string' ? title.length : typeof title}, status=${String(status)}`
    );
  }
  return t;
}

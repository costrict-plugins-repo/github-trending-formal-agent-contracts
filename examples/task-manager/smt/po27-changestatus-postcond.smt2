; Historical filename: PO numbering is VDMJ-version-dependent.
; Hand-written selected formula; not a verified translation of the full source PO.
; ChangeStatus: operation postcondition obligation (PO 26 in evidence/vdmj-po.txt, VDMJ 4.7.0 -p)
; Prove: after ChangeStatus(taskId, newStatus),
;   board(taskId).status = newStatus AND
;   board(taskId).title = board~(taskId).title
;
; The operation overwrites board(taskId) with an updated Task record
; where only status is changed, preserving all other fields.

(set-logic ALL)

; Status enum: 0=Todo, 1=InProgress, 2=Done
(declare-datatypes ((Status 0))
  (((Todo) (InProgress) (Done))))

; Task record
(declare-datatypes ((Task 0))
  (((mk_Task
    (task_id Int)
    (task_title String)
    (task_desc String)
    (task_status Status)
    (task_priority Int)
    (task_assignee String)))))

; State before operation
(declare-const taskId Int)
(declare-const newStatus Status)
(declare-const oldTask Task)

; Precondition: taskId in dom board (modeled as: oldTask exists)
(assert (>= taskId 1))
(assert (= (task_id oldTask) taskId))

; The updated task (operation body)
(declare-const updatedTask Task)
(assert (= updatedTask
  (mk_Task (task_id oldTask) (task_title oldTask) (task_desc oldTask)
           newStatus (task_priority oldTask) (task_assignee oldTask))))

; Negate postcondition:
; NOT (updatedTask.status = newStatus AND updatedTask.title = oldTask.title)
(assert (not
  (and
    (= (task_status updatedTask) newStatus)
    (= (task_title updatedTask) (task_title oldTask))
  )
))

(check-sat)
; Expected: unsat for this encoded formula; source correspondence unverified.

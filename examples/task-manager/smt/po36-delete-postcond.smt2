; Historical filename: PO numbering is VDMJ-version-dependent.
; DeleteTask: selected domain-removal clause ONLY.
; This encoding does NOT check the cardinality clause of the source postcondition.
;
; Given: pre_DeleteTask holds (taskId in set dom board)
; Operation: board' = {taskId} <-: board  (domain restriction removal)
;
; We model this with arrays + sets logic.

(set-logic ALL)

; board is modeled as a set of ids (domain of the map)
(declare-const board (Array Int Bool))
(declare-const taskId Int)

; Precondition: taskId is in dom board, taskId >= 1
(assert (>= taskId 1))
(assert (select board taskId))

; board' = board with taskId removed
(declare-const board_new (Array Int Bool))
(assert (= board_new (store board taskId false)))


; Negate the selected domain-removal clause.
; No finite-cardinality encoding is supplied here.

; Part 1: taskId is NOT in board_new (this follows directly from store)
; We check: is it possible that taskId IS in board_new?
(assert (not
  (not (select board_new taskId))
))

(check-sat)
; Expected: unsat for this encoded clause only; source correspondence unverified.

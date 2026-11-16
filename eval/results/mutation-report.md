# Mutation Testing Report
## Formal Agent Contracts Evaluation — Phase 1 Enhancement

**Report Generated:** 2026-04-02
**Method:** Automated mutation injection and test execution
**Scope:** All 30 evaluation runs (15 control, 15 treatment) across 3 benchmark tasks
**Tool:** Custom sandbox mutation runner (`mutation-fast.js`, not preserved in this repository; the current `eval/scripts/mutation-test-runner.js` is a different replacement runner and did not produce the numbers below)

> **Historical archive, not independently verified current evidence.** Control implementations
> contain deliberately introduced gaps (see `../runs/control/INTENTIONAL_GAPS.md`), so group
> differences cannot establish a causal plugin effect. The original sandbox runner counted
> compile errors and other process failures as kills and applied on average only ~1.5 mutants
> per run, so the recorded 100% kill rate carries no information about test quality. The runner
> has since been replaced (see [../README.md](../README.md)); the results below were **not**
> re-run with it. Raw files are preserved as a record of the method.

---

## Executive Summary

Mutation testing was applied to all 30 trial runs from the Formal Agent Contracts evaluation to assess the fault-detection capability of generated test suites. Both control and treatment groups recorded a **100% mutation kill rate** (46/46 mutations "killed"). This figure is not a measure of test quality: the original runner treated any test-process failure, including compile errors caused by the mutation itself, as a kill, and applied on average only 1.5 mutants per run. The result is therefore inconclusive (see Interpretation), and it provides no discriminative power between the groups.

A secondary observation: **more mutations were applicable to treatment code per run** (1.67 vs 1.40), and some mutation types (e.g., NEG-amount) had applicable sites only in treatment code. This reflects properties of the generated code (more mutable boundary/validation sites) rather than superior test detection, and is consistent with — though not independent confirmation of — more explicit, testable boundary conditions.

---

## Methodology

### Mutation Operators

Six semantic mutation operators were defined; per mutation-scores.json, only three produced applicable mutations in the evaluated code (numeric off-by-one NUM-*, boundary comparison LT-LE, condition negation NEG-*). M-REMOVE-CHECK, M-SWAP-OPERATOR, and M-REMOVE-ATOMICITY yielded no applied mutations:

| Operator | Description | Example |
|----------|-------------|---------|
| M-OFF-BY-ONE | Change numeric constants by ±1 | `1000000` → `999999` / `1000001` |
| M-BOUNDARY | Change `<` to `<=` or vice versa | `balance < limit` → `balance <= limit` |
| M-REMOVE-CHECK | Delete guard conditions | Remove `if (amount < 0) throw` |
| M-SWAP-OPERATOR | Replace arithmetic operators | `+` → `-` |
| M-NEGATE-CONDITION | Invert boolean conditions | `isActive` → `!isActive` |
| M-REMOVE-ATOMICITY | Remove state transition guards | Delete concurrency checks |

### Execution Process

For each of the 30 runs:
1. Identify mutable locations in source code using AST-pattern matching
2. Apply mutations one at a time (one-mutation-per-run model)
3. Execute the test suite against each mutant
4. Record killed (test failure) or survived (test passed)

---

## Results Summary

| Group | Runs | Total Mutations | Killed | Kill Rate | Avg Mutations/Run |
|-------|------|----------------|--------|-----------|-------------------|
| Control | 15 | 21 | 21 | **100%** | 1.40 |
| Treatment | 15 | 25 | 25 | **100%** | 1.67 |
| **Overall** | **30** | **46** | **46** | **100%** | 1.53 |

---

## Detailed Results

### Control Group (15 runs)

| Task | Run | Mutations | Killed | Mutation Types |
|------|-----|-----------|--------|---------------|
| task1-bank-account | 1 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 2 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 3 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 4 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 5 | 1 | 1 | LT-LE |
| task2-library | 1 | 1 | 1 | LT-LE |
| task2-library | 2 | 1 | 1 | LT-LE |
| task2-library | 3 | 1 | 1 | LT-LE |
| task2-library | 4 | 2 | 2 | NUM-3600000-1, LT-LE |
| task2-library | 5 | 1 | 1 | LT-LE |
| task3-auction | 1 | 1 | 1 | LT-LE |
| task3-auction | 2 | 1 | 1 | LT-LE |
| task3-auction | 3 | 1 | 1 | LT-LE |
| task3-auction | 4 | 2 | 2 | NUM-60000-1, LT-LE |
| task3-auction | 5 | 1 | 1 | LT-LE |

**Control Total:** 21 mutations, 21 killed (100%)

### Treatment Group (15 runs)

| Task | Run | Mutations | Killed | Mutation Types |
|------|-----|-----------|--------|---------------|
| task1-bank-account | 1 | 3 | 3 | NUM-1000000-1, LT-LE, **NEG-amount** |
| task1-bank-account | 2 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 3 | 2 | 2 | NUM-1000000-1, LT-LE |
| task1-bank-account | 4 | 3 | 3 | NUM-1000000-1, LT-LE, **NEG-amount** |
| task1-bank-account | 5 | 2 | 2 | NUM-1000000-1, LT-LE |
| task2-library | 1 | 1 | 1 | LT-LE |
| task2-library | 2 | 1 | 1 | LT-LE |
| task2-library | 3 | 1 | 1 | LT-LE |
| task2-library | 4 | 1 | 1 | LT-LE |
| task2-library | 5 | 1 | 1 | LT-LE |
| task3-auction | 1 | 1 | 1 | LT-LE |
| task3-auction | 2 | 2 | 2 | **NUM-300000-1**, LT-LE |
| task3-auction | 3 | 2 | 2 | **NUM-300000-1**, LT-LE |
| task3-auction | 4 | 1 | 1 | LT-LE |
| task3-auction | 5 | 2 | 2 | **NUM-300000-1**, LT-LE |

**Treatment Total:** 25 mutations, 25 killed (100%)

---

## Per-Task Analysis

### Task 1: Bank Account System (Low Complexity)

| Metric | Control (5 runs) | Treatment (5 runs) |
|--------|-------------------|---------------------|
| Total Mutations | 9 | 12 |
| Avg Mutations/Run | 1.8 | **2.4** |
| Kill Rate | 100% | 100% |
| Unique Mutation Types | 2 (NUM, LT-LE) | **3 (NUM, LT-LE, NEG)** |

Treatment runs produced code with more mutable boundary conditions. The `NEG-amount` mutation type (negation of the amount parameter in validation) appeared exclusively in 2/5 treatment runs, which is consistent with — though at n=5 not sufficient to establish — formal specifications leading to more explicit parameter validation in the generated code.

### Task 2: Library System (Medium Complexity)

| Metric | Control (5 runs) | Treatment (5 runs) |
|--------|-------------------|---------------------|
| Total Mutations | 6 | 5 |
| Avg Mutations/Run | 1.2 | 1.0 |
| Kill Rate | 100% | 100% |
| Unique Mutation Types | 2 (NUM, LT-LE) | 1 (LT-LE) |

Task 2 showed similar performance. One numeric constant mutation (NUM-3600000-1) was applicable only to control code — treatment code had no matching site, likely due to implementation differences in timeout handling.

### Task 3: Auction System (High Complexity)

| Metric | Control (5 runs) | Treatment (5 runs) |
|--------|-------------------|---------------------|
| Total Mutations | 6 | **8** |
| Avg Mutations/Run | 1.2 | **1.6** |
| Kill Rate | 100% | 100% |
| NUM boundary hits | 1/5 (20%) | **3/5 (60%)** |

Numeric-constant mutations were applicable more consistently in treatment runs' auction timeout logic (NUM-300000-1 in 3/5 runs vs NUM-60000-1 in 1/5 control runs), suggesting that formal specs produced more explicit boundary definitions in the generated code.

---

## Interpretation

### Primary Finding: 結論不能（ランナー欠陥、コンパイルエラーを kill 扱い） / Inconclusive (runner defect: compile errors counted as kills)

The 100% kill rate carries no information, for two reasons:

1. **Compile errors were counted as kills.** The original runner executed the test suite via `execSync` and recorded any thrown error as "killed". A mutation such as `<` → `<=` was applied with a global replace across the whole source file, which also rewrote TypeScript generics (`Map<string, ...>` → `Map<=string, ...>`). Such mutants fail to compile, the test process exits non-zero, and the runner records a kill even though no assertion ever ran. The 30/30 `LT-LE` kills in particular cannot be distinguished from compile failures.
2. **~1.5 mutants per run.** With 46 mutants across 30 runs (avg 1.53), the sample is too small to tell any two test suites apart, even if every kill were genuine.

No baseline run (tests against the unmutated source) was recorded, so test suites that already failed before mutation would also have been scored as 100%.

The runner has since been replaced with one that runs a baseline first, separates `killed` / `survived` / `compile-error` / `timeout` / `infra-error`, and excludes process failures from the kill-rate denominator (see [../README.md](../README.md)). These 30 runs were **not** re-run with the replacement runner, so no corrected kill rate exists. 結論: 本レポートの kill rate からテスト品質について結論することはできない。

### Secondary Finding: Treatment Code Exposes a Broader Mutation Surface

| Metric | Control | Treatment | Difference |
|--------|---------|-----------|------------|
| Avg mutations/run | 1.40 | 1.67 | +19.3% |
| Unique mutation types (Task 1) | 2 | 3 | +1 type |
| NUM boundary consistency (Task 3) | 20% | 60% | +40pp |

The treatment group's broader mutation surface suggests that formal specification-guided development produces code with **more explicit boundary conditions**. This is consistent with the primary evaluation's M2 (Spec Coverage) result of +42.8pp.

### Relationship to Primary Evaluation Metrics

| Primary Metric | Primary Result | Mutation Testing Support |
|---------------|----------------|--------------------------|
| M1 (Correctness) | +11.8pp | Both groups kill all applied mutations — no group difference detectable on this metric due to the 100% ceiling |
| M2 (Spec Coverage) | +42.8pp | More diverse mutation types applicable to treatment code — a property of the generated code |
| M4 (Explicitness) | +91.1pp | Not directly measured by mutation testing |
| M6 (Test Structure) | +20.3pp | More applicable mutation sites per run in treatment code — a property of the generated code, not direct evidence of broader test targeting |

### Limitations

0. **Runner defect**: compile errors and other process failures were counted as kills; no baseline run was performed. This invalidates the kill rate itself, not only its discriminative power
1. **Ceiling effect**: 100% kill rate prevents differentiation on this metric alone
2. **Limited mutation operators**: 6 operators defined but only 3 produced applicable mutations; semantic/concurrency mutations could reveal larger differences
3. **Small mutation count per run**: Avg 1.5 mutations limits statistical power
4. **Framework differences**: Jest (control) vs Vitest (treatment) could affect mutation applicability

---

## Conclusion

The mutation testing phase recorded a 100% kill rate for both groups, but because the runner counted compile errors as kills and applied only ~1.5 mutants per run, this figure is inconclusive (結論不能) and says nothing about whether the generated tests catch real faults; it also does not discriminate between the groups. A secondary observation — more applicable mutation sites per run in treatment code (1.67 vs 1.40, +19.3%) and additional applicable mutation types (NEG-amount) — is directionally consistent with the primary evaluation's findings, particularly M2 (Spec Coverage +42.8pp) and M6 (Test Structure +20.3pp), but it reflects the structure of the generated code rather than test quality, and does not independently confirm that formal specification-guided development produces more thorough and explicit code.

---

## Raw Data

- Results: [mutation-scores.json](mutation-scores.json)
- Test runner: sandbox runner `mutation-fast.js` not preserved; the current [mutation-test-runner.js](../scripts/mutation-test-runner.js) is a different replacement runner (see [../README.md](../README.md)) and did not produce these results
- Primary evaluation: [scores.json](scores.json)

# テストテンプレート集

VDM-SL仕様から自動生成されるテストの標準テンプレート集です。各テンプレートにはVDM-SL入力パターンとそれに対応するVitestテストコード出力を記載します。

**テンプレートの読み方**

- このファイルは任意の追加例。テストは `../SKILL.md` だけで書ける。状態を持つ操作（`state` / `operations`）のテストは `../SKILL.md` の戦略Fにある。
- 「VDM-SL入力パターン」は、VDMJ 4.7.0 の構文チェック・型チェックを通した書き方。`types` / `functions` の見出しの下に書く断片として示している。各断片は、使う型の定義も含めてあり、単独でモジュールに組み込んで検査できる。断片はテンプレートごとに独立していて、同じ名前の型（`Ticket`）でもテンプレートによってフィールドが違う。
- 出力例の import 元（`./validators`、`./functions` など）と関数名（`isValidScore` など）は説明用で、実在しない。実際のテストは、`generate-code` が出力した実装（仕様ファイルと同じディレクトリの `generated/`）の実在する export を、拡張子付きの相対パス（例：`'../generated/index.ts'`）で import する。テストの中に実装を書き写さない。
- 出力例は Vitest 形式。ランナーは `../SKILL.md` のステップ0で決まったものに合わせる。`node:test` で書く場合の対応は、同ステップ3の表を参照。
- 出力例にある引数なしの `.toThrow()` も説明用。実際のテストでは、契約違反は実装が export しているエラークラスで判定する（`generate-code` の出力では `expect(() => ...).toThrow(ContractError)`。`../SKILL.md` のステップ3「契約違反の判定」と 3c）。引数なしの `.toThrow()` は、契約と無関係な例外（`TypeError` など）でも成功してしまう。

---

## テンプレート1：型不変式テスト

**対象**: VDM-SLの`inv`（不変式）定義
**テスト目的**: 型が常に制約を満たすことを検証

### VDM-SL入力パターン

```vdm-sl
types

-- パターン1a: 単純な数値範囲
Score = nat1
inv s == s <= 100;

-- パターン1b: 0 を含む範囲（0以上の整数は nat）
Priority = nat
inv p == p <= 10;

-- パターン1c: レコード型の不変式（inv はレコード定義の直後に書く）
Ticket ::
  id       : nat1
  title    : seq of char
  priority : Priority
inv t == len t.title > 0 and len t.title <= 255;
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import { isValidScore, isValidPriority, isValidTicket } from './validators';

// ============================================
// テンプレート1：型不変式テスト
// ============================================

describe('Type Invariants', () => {
  
  // ============================================
  // テスト1a: 数値範囲の不変式
  // ============================================
  
  describe('Score type (nat1, inv: 1 <= s <= 100)', () => {
    // 有効な境界値
    it('accepts score at lower boundary (1)', () => {
      expect(isValidScore(1)).toBe(true);
    });
    
    it('accepts score at upper boundary (100)', () => {
      expect(isValidScore(100)).toBe(true);
    });
    
    it('accepts score within range (50)', () => {
      expect(isValidScore(50)).toBe(true);
    });
    
    // 無効な値
    it('rejects score below lower boundary (0)', () => {
      expect(isValidScore(0)).toBe(false);
    });
    
    it('rejects score above upper boundary (101)', () => {
      expect(isValidScore(101)).toBe(false);
    });
    
    it('rejects negative score (-5)', () => {
      expect(isValidScore(-5)).toBe(false);
    });
    
    // 非整数値（JavaScriptの場合）
    it('rejects non-integer score (50.5)', () => {
      expect(isValidScore(50.5)).toBe(false);
    });
  });
  
  // ============================================
  // テスト1b: 複合条件の不変式
  // ============================================
  
  describe('Priority type (nat, inv: p <= 10)', () => {
    const validPriorities = [0, 1, 5, 10];
    const invalidPriorities = [-1, 11, 100, -100];
    
    validPriorities.forEach(p => {
      it(`accepts valid priority (${p})`, () => {
        expect(isValidPriority(p)).toBe(true);
      });
    });
    
    invalidPriorities.forEach(p => {
      it(`rejects invalid priority (${p})`, () => {
        expect(isValidPriority(p)).toBe(false);
      });
    });
  });
  
  // ============================================
  // テスト1c: レコード型の不変式
  // ============================================
  
  describe('Ticket record type', () => {
    it('accepts valid ticket', () => {
      const ticket = {
        id: 1,
        title: 'Test Ticket',
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(true);
    });
    
    // id の制約
    it('rejects ticket with invalid id (0)', () => {
      const ticket = {
        id: 0,
        title: 'Test',
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(false);
    });
    
    it('rejects ticket with negative id', () => {
      const ticket = {
        id: -1,
        title: 'Test',
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(false);
    });
    
    // title の制約
    it('rejects ticket with empty title', () => {
      const ticket = {
        id: 1,
        title: '',
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(false);
    });
    
    it('rejects ticket with oversized title (256+ chars)', () => {
      const ticket = {
        id: 1,
        title: 'x'.repeat(256),
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(false);
    });
    
    it('accepts ticket with max-length title (255 chars)', () => {
      const ticket = {
        id: 1,
        title: 'x'.repeat(255),
        priority: 5
      };
      expect(isValidTicket(ticket)).toBe(true);
    });
    
    // priority の制約
    it('rejects ticket with invalid priority', () => {
      const ticket = {
        id: 1,
        title: 'Test',
        priority: 11
      };
      expect(isValidTicket(ticket)).toBe(false);
    });
  });
});
```

---

## テンプレート2：前提条件テスト

**対象**: VDM-SLの`pre`（前提条件）定義
**テスト目的**: 関数が前提条件を適切に検証することを確認

### VDM-SL入力パターン

```vdm-sl
types

-- この断片が使う型
Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  title            : seq1 of char
  complexity_score : nat1;

functions

-- パターン2a: 単純な前提条件
increment : nat1 -> nat1
increment(n) == n + 1
pre n < 100;

-- パターン2b: 複合前提条件
decide : Ticket * nat * nat -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
pre t1 > t2 and
    ticket.complexity_score >= 1 and ticket.complexity_score <= 100 and
    t1 >= 1 and t1 <= 100 and
    t2 >= 1 and t2 <= 100;

-- パターン2c: 集合操作の前提条件
findElement : set of nat * nat -> bool
findElement(s, x) == x in set s
pre s <> {} and x > 0;
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import { increment, decide, findElement } from './functions';

// ============================================
// テンプレート2：前提条件テスト
// ============================================

describe('Preconditions', () => {
  
  // ============================================
  // テスト2a: 単純な前提条件
  // ============================================
  
  describe('increment(n) precondition: n < 100', () => {
    // 前提条件を満たす場合：実行成功
    it('succeeds when precondition is met (n=50)', () => {
      expect(() => increment(50)).not.toThrow();
      expect(increment(50)).toBe(51);
    });
    
    it('succeeds when at boundary (n=99)', () => {
      expect(() => increment(99)).not.toThrow();
      expect(increment(99)).toBe(100);
    });
    
    // 前提条件を満たさない場合：エラーまたは例外
    it('throws error when precondition violated (n=100)', () => {
      expect(() => increment(100)).toThrow(
        /[Pp]recondition|[Pp]re-condition/
      );
    });
    
    it('throws error when n exceeds limit (n=101)', () => {
      expect(() => increment(101)).toThrow();
    });
  });
  
  // ============================================
  // テスト2b: 複合前提条件
  // ============================================
  
  describe('decide(ticket, t1, t2) preconditions', () => {
    const validTicket = {
      id: 1,
      title: 'Test',
      complexity_score: 50
    };
    
    // すべての前提条件を満たす場合
    it('succeeds when all preconditions met', () => {
      expect(() => decide(validTicket, 80, 20)).not.toThrow();
    });
    
    // 前提条件1: t1 > t2
    describe('precondition: t1 > t2', () => {
      it('succeeds when t1 > t2 (80 > 20)', () => {
        expect(() => decide(validTicket, 80, 20)).not.toThrow();
      });
      
      it('throws when t1 == t2 (20 == 20)', () => {
        expect(() => decide(validTicket, 20, 20)).toThrow();
      });
      
      it('throws when t1 < t2 (20 < 80)', () => {
        expect(() => decide(validTicket, 20, 80)).toThrow();
      });
    });
    
    // 前提条件2: complexity_score が有効範囲
    describe('precondition: 1 <= complexity_score <= 100', () => {
      it('succeeds with score=1', () => {
        const ticket = { ...validTicket, complexity_score: 1 };
        expect(() => decide(ticket, 80, 20)).not.toThrow();
      });
      
      it('succeeds with score=100', () => {
        const ticket = { ...validTicket, complexity_score: 100 };
        expect(() => decide(ticket, 80, 20)).not.toThrow();
      });
      
      it('throws with score=0', () => {
        const ticket = { ...validTicket, complexity_score: 0 };
        expect(() => decide(ticket, 80, 20)).toThrow();
      });
      
      it('throws with score=101', () => {
        const ticket = { ...validTicket, complexity_score: 101 };
        expect(() => decide(ticket, 80, 20)).toThrow();
      });
    });
    
    // 前提条件3-4: t1, t2 が有効範囲
    describe('precondition: 1 <= t1, t2 <= 100', () => {
      it('throws when t1=0', () => {
        expect(() => decide(validTicket, 0, 20)).toThrow();
      });
      
      it('throws when t1=101', () => {
        expect(() => decide(validTicket, 101, 20)).toThrow();
      });
      
      it('throws when t2=0', () => {
        expect(() => decide(validTicket, 80, 0)).toThrow();
      });
      
      it('throws when t2=101', () => {
        expect(() => decide(validTicket, 80, 101)).toThrow();
      });
    });
  });
  
  // ============================================
  // テスト2c: 集合操作の前提条件
  // ============================================
  
  describe('findElement(s, x) preconditions', () => {
    describe('precondition: s <> {} and x > 0', () => {
      it('succeeds with non-empty set and positive x', () => {
        const set = new Set([1, 2, 3]);
        expect(() => findElement(set, 2)).not.toThrow();
      });
      
      it('throws when set is empty', () => {
        const set = new Set();
        expect(() => findElement(set, 5)).toThrow();
      });
      
      it('throws when x <= 0', () => {
        const set = new Set([1, 2, 3]);
        expect(() => findElement(set, 0)).toThrow();
      });
      
      it('throws when x < 0', () => {
        const set = new Set([1, 2, 3]);
        expect(() => findElement(set, -5)).toThrow();
      });
    });
  });
});
```

---

## テンプレート3：事後条件テスト

**対象**: VDM-SLの`post`（事後条件）定義
**テスト目的**: 関数が約束した結果を返すことを検証

### VDM-SL入力パターン

```vdm-sl
types

-- この断片が使う型
Score = nat1
inv s == s <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  complexity_score : Score;

functions

-- パターン3a: 単純な事後条件（戻り値は RESULT で参照する）
absolute : int -> nat
absolute(n) == if n >= 0 then n else -n
post RESULT >= 0;

-- パターン3b: 複合的な論理式の事後条件
decide : Ticket * Score * Score -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
pre t1 > t2
post (ticket.complexity_score > t1 => RESULT = <OperatorOnly>) and
     (t2 < ticket.complexity_score and ticket.complexity_score <= t1
        => RESULT = <OperatorAndLLM>) and
     (ticket.complexity_score <= t2 => RESULT = <AutoReply>);

-- パターン3c: 入力と出力の関係を述べる事後条件
addElement : set of nat1 * nat1 -> set of nat1
addElement(s, x) == s union {x}
post x in set RESULT and
     forall e in set s & e in set RESULT;
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import { absolute, decide, addElement } from './functions';

// ============================================
// テンプレート3：事後条件テスト
// ============================================

describe('Postconditions', () => {
  
  // ============================================
  // テスト3a: 単純な事後条件
  // ============================================
  
  describe('absolute(n) postcondition: result >= 0', () => {
    it('returns non-negative for positive input (5)', () => {
      const result = absolute(5);
      expect(result).toBeGreaterThanOrEqual(0);
    });
    
    it('returns non-negative for negative input (-5)', () => {
      const result = absolute(-5);
      expect(result).toBeGreaterThanOrEqual(0);
    });
    
    it('returns non-negative for zero (0)', () => {
      const result = absolute(0);
      expect(result).toBeGreaterThanOrEqual(0);
    });
    
    // より詳細な検証
    it('returns correct value for positive input', () => {
      expect(absolute(5)).toBe(5);
    });
    
    it('returns correct value for negative input', () => {
      expect(absolute(-5)).toBe(5);
    });
    
    it('returns correct value for zero', () => {
      expect(absolute(0)).toBe(0);
    });
  });
  
  // ============================================
  // テスト3b: 複合的な論理式の事後条件
  // ============================================
  
  describe('decide(ticket, t1, t2) postcondition', () => {
    // テストケーステーブル：
    // [complexity_score, t1, t2, expectedAction]
    const testCases = [
      // 条件: complexity_score > t1
      { score: 90, t1: 80, t2: 20, expected: 'OperatorOnly' },
      { score: 100, t1: 80, t2: 20, expected: 'OperatorOnly' },
      
      // エッジケース: complexity_score == t1
      { score: 80, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
      
      // 条件: t2 < complexity_score <= t1
      { score: 50, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
      { score: 21, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
      
      // エッジケース: complexity_score == t2
      { score: 20, t1: 80, t2: 20, expected: 'AutoReply' },
      
      // 条件: complexity_score <= t2
      { score: 10, t1: 80, t2: 20, expected: 'AutoReply' },
      { score: 1, t1: 80, t2: 20, expected: 'AutoReply' },
    ];
    
    testCases.forEach(({ score, t1, t2, expected }) => {
      it(
        `returns ${expected} ` +
        `(score=${score}, t1=${t1}, t2=${t2})`,
        () => {
          const ticket = { id: 1, complexity_score: score };
          const result = decide(ticket, t1, t2);
          expect(result).toBe(expected);
        }
      );
    });
    
    // 条件ごとの詳細テスト
    describe('condition: complexity_score > t1', () => {
      it('returns OperatorOnly', () => {
        const ticket = { id: 1, complexity_score: 90 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('OperatorOnly');
      });
      
      it('returns OperatorOnly for score=100, t1=99', () => {
        const ticket = { id: 1, complexity_score: 100 };
        const result = decide(ticket, 99, 20);
        expect(result).toBe('OperatorOnly');
      });
    });
    
    describe('condition: t2 < complexity_score <= t1', () => {
      it('returns OperatorAndLLM', () => {
        const ticket = { id: 1, complexity_score: 50 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('OperatorAndLLM');
      });
      
      it('returns OperatorAndLLM for score=t1', () => {
        const ticket = { id: 1, complexity_score: 80 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('OperatorAndLLM');
      });
      
      it('returns OperatorAndLLM for score=t2+1', () => {
        const ticket = { id: 1, complexity_score: 21 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('OperatorAndLLM');
      });
    });
    
    describe('condition: complexity_score <= t2', () => {
      it('returns AutoReply', () => {
        const ticket = { id: 1, complexity_score: 10 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('AutoReply');
      });
      
      it('returns AutoReply for score=t2', () => {
        const ticket = { id: 1, complexity_score: 20 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('AutoReply');
      });
      
      it('returns AutoReply for score=1', () => {
        const ticket = { id: 1, complexity_score: 1 };
        const result = decide(ticket, 80, 20);
        expect(result).toBe('AutoReply');
      });
    });
  });
  
  // ============================================
  // テスト3c: 状態変化の事後条件
  // ============================================
  
  describe('addElement(s, x) postcondition', () => {
    it('added element is in result set', () => {
      const set = new Set([1, 2, 3]);
      const result = addElement(set, 4);
      expect(result.has(4)).toBe(true);
    });
    
    it('original elements remain in result', () => {
      const set = new Set([1, 2, 3]);
      const result = addElement(set, 4);
      expect(result.has(1)).toBe(true);
      expect(result.has(2)).toBe(true);
      expect(result.has(3)).toBe(true);
    });
    
    it('result size increases by 1 for new element', () => {
      const set = new Set([1, 2, 3]);
      const result = addElement(set, 4);
      expect(result.size).toBe(set.size + 1);
    });
    
    it('result size unchanged when adding existing element', () => {
      const set = new Set([1, 2, 3]);
      const result = addElement(set, 3);  // 3は既に存在
      expect(result.size).toBe(set.size);
    });
  });
});
```

---

## テンプレート4：プロトコルメッセージ型テスト

**対象**: VDM-SLのメッセージプロトコル定義
**テスト目的**: メッセージ型とペイロードの整合性を検証

### VDM-SL入力パターン

```vdm-sl
types

-- パターン4a: メッセージ型定義
UserMsgType = <TicketCreate> | <TicketUpdate> | <EscalationRequest>;
ServerToUserMsgType = <TicketCreated> | <AutoReply> | <OperatorReply>;

-- パターン4b: ペイロード型定義
TicketCreatePayload ::
  customer_id : nat1
  title       : seq of char;

AutoReplyPayload ::
  ticket_id  : nat1
  reply_text : seq of char;

-- パターン4c: WsMessage不変式（メッセージ型とペイロード型の対応）
WsMessage ::
  msg_type : UserMsgType | ServerToUserMsgType
  payload  : TicketCreatePayload | AutoReplyPayload
inv m ==
  (m.msg_type = <TicketCreate> => is_TicketCreatePayload(m.payload)) and
  (m.msg_type = <AutoReply> => is_AutoReplyPayload(m.payload));
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import {
  isValidWsMessage,
  isTicketCreatePayload,
  isAutoReplyPayload,
  isClientToServer,
  isServerToClient
} from './protocol';

// ============================================
// テンプレート4：プロトコルテスト
// ============================================

describe('MessageProtocol', () => {
  
  // ============================================
  // テスト4a: メッセージ型とペイロード整合性
  // ============================================
  
  describe('WsMessage invariants', () => {
    it('TicketCreate message with correct payload', () => {
      const msg = {
        msg_type: 'TicketCreate',
        payload: {
          customer_id: 1,
          title: 'New Bug'
        },
        timestamp: Date.now()
      };
      expect(isValidWsMessage(msg)).toBe(true);
      expect(isTicketCreatePayload(msg.payload)).toBe(true);
    });
    
    it('rejects TicketCreate with wrong payload type', () => {
      const msg = {
        msg_type: 'TicketCreate',
        payload: {
          ticket_id: 100,
          reply_text: 'Got it'  // AutoReplyPayload
        },
        timestamp: Date.now()
      };
      expect(isValidWsMessage(msg)).toBe(false);
    });
    
    it('AutoReply message with correct payload', () => {
      const msg = {
        msg_type: 'AutoReply',
        payload: {
          ticket_id: 100,
          reply_text: 'Thank you'
        },
        timestamp: Date.now()
      };
      expect(isValidWsMessage(msg)).toBe(true);
      expect(isAutoReplyPayload(msg.payload)).toBe(true);
    });
    
    it('rejects AutoReply with wrong payload type', () => {
      const msg = {
        msg_type: 'AutoReply',
        payload: {
          customer_id: 1,
          title: 'wrong'  // TicketCreatePayload
        },
        timestamp: Date.now()
      };
      expect(isValidWsMessage(msg)).toBe(false);
    });
    
    // すべてのメッセージ型を網羅
    const messagePayloadPairs = [
      ['TicketCreate', { customer_id: 1, title: 'Test' }],
      ['TicketUpdate', { ticket_id: 100, new_status: 'Assigned' }],
      ['EscalationRequest', { ticket_id: 100, reason: 'Complex' }],
      ['TicketCreated', { ticket_id: 100, status: 'Created' }],
      ['AutoReply', { ticket_id: 100, reply_text: 'OK' }],
      ['OperatorReply', { ticket_id: 100, operator_id: 1, message: 'Handled' }],
    ];
    
    messagePayloadPairs.forEach(([msgType, payload]) => {
      it(`validates ${msgType} message`, () => {
        const msg = {
          msg_type: msgType,
          payload: payload,
          timestamp: Date.now()
        };
        expect(isValidWsMessage(msg)).toBe(true);
      });
    });
  });
  
  // ============================================
  // テスト4b: ペイロード型の個別検証
  // ============================================
  
  describe('Payload type validation', () => {
    describe('TicketCreatePayload', () => {
      it('accepts valid payload', () => {
        const payload = {
          customer_id: 1,
          title: 'Bug Report'
        };
        expect(isTicketCreatePayload(payload)).toBe(true);
      });
      
      it('rejects payload with missing customer_id', () => {
        const payload = {
          title: 'Bug Report'
        };
        expect(isTicketCreatePayload(payload)).toBe(false);
      });
      
      it('rejects payload with invalid customer_id (0)', () => {
        const payload = {
          customer_id: 0,
          title: 'Bug Report'
        };
        expect(isTicketCreatePayload(payload)).toBe(false);
      });
      
      it('rejects payload with empty title', () => {
        const payload = {
          customer_id: 1,
          title: ''
        };
        expect(isTicketCreatePayload(payload)).toBe(false);
      });
    });
    
    describe('AutoReplyPayload', () => {
      it('accepts valid payload', () => {
        const payload = {
          ticket_id: 100,
          reply_text: 'Thank you for reporting'
        };
        expect(isAutoReplyPayload(payload)).toBe(true);
      });
      
      it('rejects payload with missing fields', () => {
        const payload = {
          ticket_id: 100
        };
        expect(isAutoReplyPayload(payload)).toBe(false);
      });
    });
  });
  
  // ============================================
  // テスト4c: メッセージ方向の検証
  // ============================================
  
  describe('Message direction', () => {
    it('isClientToServer returns true for TicketCreate', () => {
      const msg = { msg_type: 'TicketCreate' };
      expect(isClientToServer(msg)).toBe(true);
    });
    
    it('isClientToServer returns true for UserMsgType', () => {
      const userMessages = ['TicketCreate', 'TicketUpdate', 'EscalationRequest'];
      userMessages.forEach(type => {
        const msg = { msg_type: type };
        expect(isClientToServer(msg)).toBe(true);
      });
    });
    
    it('isClientToServer returns false for ServerToUserMsgType', () => {
      const serverMessages = ['TicketCreated', 'AutoReply', 'OperatorReply'];
      serverMessages.forEach(type => {
        const msg = { msg_type: type };
        expect(isClientToServer(msg)).toBe(false);
      });
    });
    
    it('isServerToClient returns true for AutoReply', () => {
      const msg = { msg_type: 'AutoReply' };
      expect(isServerToClient(msg)).toBe(true);
    });
    
    it('isServerToClient returns false for TicketCreate', () => {
      const msg = { msg_type: 'TicketCreate' };
      expect(isServerToClient(msg)).toBe(false);
    });
  });
});
```

---

## テンプレート5：状態遷移テスト

**対象**: VDM-SLの状態遷移規則（`validTransition`等）
**テスト目的**: 状態遷移の有効性と完全性を検証

### VDM-SL入力パターン

```vdm-sl
types

-- パターン5a: 単純な状態遷移
TicketStatus = <Created> | <Assigned> | <InProgress> | <Resolved> | <Closed>;

-- パターン5b: 複雑な状態機械
SystemState = <Idle> | <Processing> | <Error> | <Complete>;

functions

-- from / to は予約語なので引数名に使えない
validTransition : TicketStatus * TicketStatus -> bool
validTransition(current, next) ==
  cases current:
    <Created>    -> next in set {<Assigned>, <Closed>},
    <Assigned>   -> next in set {<InProgress>, <Closed>},
    <InProgress> -> next in set {<Resolved>, <Closed>},
    <Resolved>   -> next = <Closed>,
    <Closed>     -> false   -- 終了状態：どこへも遷移できない
  end;
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import { validTransition, computeReachable } from './statemachine';

// ============================================
// テンプレート5：状態遷移テスト
// ============================================

describe('State Transitions', () => {
  
  // ============================================
  // テスト5a: 有効な遷移
  // ============================================
  
  describe('validTransition function', () => {
    describe('valid transitions', () => {
      const validTransitions = [
        // from Created
        ['Created', 'Assigned'],
        ['Created', 'Closed'],
        
        // from Assigned
        ['Assigned', 'InProgress'],
        ['Assigned', 'Closed'],
        
        // from InProgress
        ['InProgress', 'Resolved'],
        ['InProgress', 'Closed'],
        
        // from Resolved
        ['Resolved', 'Closed'],
      ];
      
      validTransitions.forEach(([from, to]) => {
        it(`allows transition ${from} -> ${to}`, () => {
          expect(validTransition(from, to)).toBe(true);
        });
      });
    });
    
    // ============================================
    // テスト5b: 無効な遷移
    // ============================================
    
    describe('invalid transitions', () => {
      const invalidTransitions = [
        // from Created（許可されない遷移）
        ['Created', 'InProgress'],
        ['Created', 'Resolved'],
        
        // from Assigned
        ['Assigned', 'Created'],
        ['Assigned', 'Assigned'],
        
        // from InProgress
        ['InProgress', 'Assigned'],
        ['InProgress', 'Created'],
        
        // from Resolved
        ['Resolved', 'InProgress'],
        ['Resolved', 'Assigned'],
        
        // from Closed（終了状態。自分自身への遷移も許可されない）
        ['Closed', 'Created'],
        ['Closed', 'Assigned'],
        ['Closed', 'Closed'],
      ];
      
      invalidTransitions.forEach(([from, to]) => {
        it(`rejects transition ${from} -> ${to}`, () => {
          expect(validTransition(from, to)).toBe(false);
        });
      });
    });
  });
  
  // ============================================
  // テスト5c: 状態到達可能性
  // ============================================
  
  describe('State reachability', () => {
    it('all states reachable from Created', () => {
      const reachable = computeReachable('Created');
      expect(reachable).toContain('Created');
      expect(reachable).toContain('Assigned');
      expect(reachable).toContain('InProgress');
      expect(reachable).toContain('Resolved');
      expect(reachable).toContain('Closed');
    });
    
    it('normal path: Created -> Assigned -> InProgress -> Resolved -> Closed', () => {
      expect(validTransition('Created', 'Assigned')).toBe(true);
      expect(validTransition('Assigned', 'InProgress')).toBe(true);
      expect(validTransition('InProgress', 'Resolved')).toBe(true);
      expect(validTransition('Resolved', 'Closed')).toBe(true);
    });
    
    it('cancellation path: any state -> Closed', () => {
      const states = ['Created', 'Assigned', 'InProgress', 'Resolved'];
      states.forEach(state => {
        expect(validTransition(state, 'Closed')).toBe(true);
      });
    });
  });
  
  // ============================================
  // テスト5d: 状態機械の性質
  // ============================================
  
  describe('State machine properties', () => {
    it('no self-transitions', () => {
      // どの状態にも自己遷移がないことを確認（Closed を含む）
      const allStates = ['Created', 'Assigned', 'InProgress', 'Resolved', 'Closed'];
      allStates.forEach(state => {
        expect(validTransition(state, state)).toBe(false);
      });
    });
    
    it('Closed is terminal state', () => {
      // Closedからはどの状態にも遷移できない
      const allStates = ['Created', 'Assigned', 'InProgress', 'Resolved', 'Closed'];
      allStates.forEach(state => {
        expect(validTransition('Closed', state)).toBe(false);
      });
    });
    
    it('Created is initial state with limited options', () => {
      // Createdからはこの2つの遷移のみ
      expect(validTransition('Created', 'Assigned')).toBe(true);
      expect(validTransition('Created', 'Closed')).toBe(true);
      
      const otherStates = ['InProgress', 'Resolved'];
      otherStates.forEach(state => {
        expect(validTransition('Created', state)).toBe(false);
      });
    });
  });
});
```

---

## テンプレート6：インターフェース互換性テスト

**対象**: VDM-SL仕様と実装コードの対応検証
**テスト目的**: VDM-SL仕様が実装で正確に実現されていることを確認

### VDM-SL入力パターン

```vdm-sl
types

-- パターン6a: 型対応の検証
Score = nat1
inv s == s <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  title            : seq1 of char
  content          : seq of char
  priority         : nat
  complexity_score : Score;

functions

-- パターン6b: 関数シグネチャの対応（引数の型は * で並べる）
decide : Ticket * Score * Score -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
pre t1 > t2
post RESULT in set {<AutoReply>, <OperatorAndLLM>, <OperatorOnly>};
```

### Vitestテスト出力

```javascript
import { describe, it, expect } from 'vitest';
import type { Score, Ticket, Action } from './types';
import { decide } from './HybridJudgeAgent';

// ============================================
// テンプレート6：インターフェース互換性テスト
// ============================================

describe('VDM-SL Type Implementation Compatibility', () => {
  
  // ============================================
  // テスト6a: TypeScript型対応
  // ============================================
  
  describe('Type correspondences', () => {
    it('Score type is implemented as number', () => {
      const score: Score = 50;
      expect(typeof score).toBe('number');
      expect(Number.isInteger(score)).toBe(true);
    });
    
    it('Score respects nat1 invariant (1-100)', () => {
      const validScores: Score[] = [1, 50, 100];
      validScores.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(100);
      });
    });
    
    it('Ticket type has required fields', () => {
      const ticket: Ticket = {
        id: 1,
        title: 'Test',
        content: 'Description',
        priority: 5,
        complexity_score: 50
      };
      
      expect(ticket).toHaveProperty('id');
      expect(ticket).toHaveProperty('title');
      expect(ticket).toHaveProperty('content');
      expect(ticket).toHaveProperty('priority');
      expect(ticket).toHaveProperty('complexity_score');
    });
    
    it('Action is union of correct values', () => {
      const validActions: Action[] = ['AutoReply', 'OperatorAndLLM', 'OperatorOnly'];
      validActions.forEach(action => {
        expect(['AutoReply', 'OperatorAndLLM', 'OperatorOnly']).toContain(action);
      });
    });
  });
  
  // ============================================
  // テスト6b: 関数シグネチャの対応
  // ============================================
  
  describe('Function signature implementation', () => {
    it('decide accepts 3 parameters', () => {
      const ticket: Ticket = { id: 1, title: 'Test', content: '', priority: 5, complexity_score: 50 };
      expect(() => decide(ticket, 80, 20)).not.toThrow();
    });
    
    it('decide returns Action type', () => {
      const ticket: Ticket = { id: 1, title: 'Test', content: '', priority: 5, complexity_score: 50 };
      const result = decide(ticket, 80, 20);
      expect(['AutoReply', 'OperatorAndLLM', 'OperatorOnly']).toContain(result);
    });
    
    it('decide parameter types match VDM-SL spec', () => {
      const ticket: Ticket = { id: 1, title: 'Test', content: '', priority: 5, complexity_score: 50 };
      const t1: Score = 80;
      const t2: Score = 20;
      
      expect(typeof ticket).toBe('object');
      expect(typeof t1).toBe('number');
      expect(typeof t2).toBe('number');
      
      expect(() => decide(ticket, t1, t2)).not.toThrow();
    });
  });
  
  // ============================================
  // テスト6c: 前提条件の実装対応
  // ============================================
  
  describe('Precondition implementation', () => {
    const validTicket: Ticket = {
      id: 1,
      title: 'Test',
      content: 'Description',
      priority: 5,
      complexity_score: 50
    };
    
    it('pre(t1 > t2) is enforced', () => {
      // t1 > t2の場合は成功
      expect(() => decide(validTicket, 80, 20)).not.toThrow();
      
      // t1 <= t2の場合はエラー
      expect(() => decide(validTicket, 20, 80)).toThrow();
    });
    
    it('pre(1 <= complexity_score <= 100) is enforced', () => {
      // 有効な複雑度スコア
      expect(() => decide({ ...validTicket, complexity_score: 1 }, 80, 20)).not.toThrow();
      expect(() => decide({ ...validTicket, complexity_score: 100 }, 80, 20)).not.toThrow();
      
      // 無効な複雑度スコア
      expect(() => decide({ ...validTicket, complexity_score: 0 }, 80, 20)).toThrow();
      expect(() => decide({ ...validTicket, complexity_score: 101 }, 80, 20)).toThrow();
    });
  });
  
  // ============================================
  // テスト6d: 事後条件の実装対応
  // ============================================
  
  describe('Postcondition implementation', () => {
    it('post conditions are satisfied for all valid inputs', () => {
      const testCases = [
        { score: 90, t1: 80, t2: 20, expected: 'OperatorOnly' },
        { score: 50, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
        { score: 10, t1: 80, t2: 20, expected: 'AutoReply' },
      ];
      
      testCases.forEach(({ score, t1, t2, expected }) => {
        const ticket: Ticket = { id: 1, title: 'Test', content: '', priority: 5, complexity_score: score };
        const result = decide(ticket, t1, t2);
        expect(result).toBe(expected);
      });
    });
  });
});
```

---

## VDM-SL の型と実装の対応

VDM-SL の型・不変式・事前条件・事後条件が実装でどう表されるか（実行時チェック、契約違反のエラーの型）は、`generate-code` スキルの `references/typescript-rules.md` が定めています。テストは、その規則で生成された `generated/` の実在する export に合わせて書きます。

---

## テスト生成時のベストプラクティス

### 1. テストケースの体系的抽出

```javascript
// ❌ アドホックなテストケース
it('works with score 50', () => { ... });
it('works with score 80', () => { ... });

// ✓ VDM-SLから体系的に抽出
const testCases = [
  // 前提条件を満たさないケース
  { score: 0, t1: 80, t2: 20, shouldThrow: true },
  
  // 各分岐をカバーするケース
  { score: 90, t1: 80, t2: 20, expected: 'OperatorOnly' },
  { score: 50, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
  { score: 10, t1: 80, t2: 20, expected: 'AutoReply' },
  
  // エッジケース
  { score: 80, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
  { score: 20, t1: 80, t2: 20, expected: 'AutoReply' },
];

testCases.forEach(tc => {
  // 各ケースをテスト
});
```

### 2. メッセージプロトコルの網羅的なテスト

```javascript
// すべてのメッセージ型を定義
const allMessageTypes = [
  'TicketCreate', 'TicketUpdate', 'EscalationRequest',
  'ReplyManual', 'MarkComplete', 'EscalateOperator',
  'TicketCreated', 'AutoReply', 'OperatorReply', 'TicketUpdated'
];

// 各メッセージに対応するペイロード型を検証
allMessageTypes.forEach(msgType => {
  it(`validates ${msgType} message`, () => {
    const msg = createMessage(msgType, payloadForType(msgType));
    expect(isValidWsMessage(msg)).toBe(true);
  });
});
```

### 3. 状態遷移の完全性テスト

```javascript
// すべての状態ペアを検証
const states = ['Created', 'Assigned', 'InProgress', 'Resolved', 'Closed'];

states.forEach(from => {
  states.forEach(to => {
    const isValid = validTransition(from, to);
    // VDM-SL定義と一致するか確認
    expect(isValid).toBe(expectedTransition(from, to));
  });
});
```


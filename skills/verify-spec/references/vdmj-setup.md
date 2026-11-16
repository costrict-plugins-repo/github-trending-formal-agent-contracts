# VDMJ Setup Guide / VDMJセットアップガイド

## What is VDMJ? / VDMJとは

VDMJ is an integrated toolchain for VDM-SL/VDM++/VDM-RT. Implemented in Java, it includes
a parser, type checker, interpreter, PO generator, and QuickCheck.

VDMJはVDM-SL/VDM++/VDM-RTの統合ツールチェーン。Javaで実装されており、
パーサー、型チェッカー、インタプリタ、PO生成器、QuickCheckを含む。

- Repository: https://github.com/nickbattle/vdmj
- License: GPL v3
- Requirements: Java 11 or later, installed first (Step 1 below). The `vdmj.sh` launcher in the
  distribution is a bash script that calls the `which` command, and Step 2 uses `unzip`. macOS
  has all three; a minimal Linux image may lack `which` or `unzip`.
- 必要環境: Java 11以上（先に入れる。下の手順1）。配布版の起動スクリプト `vdmj.sh` は bash のスクリプトで
  `which` コマンドを使い、手順2では `unzip` を使う。macOS には3つともあるが、最小構成の Linux には
  `which` や `unzip` が無いことがある。

## Installation / インストール方法

Do Step 1 (Java) before Step 2 (VDMJ): the last command of Step 2 already needs Java.

手順1（Java）を手順2（VDMJ）より先に行う。手順2の最後のコマンドが Java を使うため。

### Step 1: Java (JDK 11 or later) / 手順1：Java（JDK 11以上）

VDMJ does not include Java, and the `verify-spec` skill does not install it.

1. Run `java -version`. If it prints a version (11 or later), go to Step 2. On macOS a `java`
   command can exist while no Java runtime is installed; it then prints an error
   ("Unable to locate a Java Runtime") instead of a version.
2. Otherwise install a JDK, 11 or later. One source is Eclipse Temurin (https://adoptium.net/):
   - **Installer or package manager**: run the installer for your OS, or use your OS's package
     manager. Then open a new terminal and run `java -version` again. (This route was not run
     when this guide was written.)
   - **Archive (`.tar.gz`)**: unpack it anywhere, then point the shell at it with the two
     `export` lines below.
3. An `export` typed into a terminal is gone when that shell exits. To keep it, add the two
   lines to your shell's startup file (for zsh: `~/.zshrc`) and check `java -version` in a new shell.

VDMJ は Java を含まず、`verify-spec` スキルも Java をインストールしない。

1. `java -version` を実行する。版（11以上）が表示されれば手順2へ進む。macOS では `java` コマンドがあっても
   Java 本体が入っていないことがあり、その場合は版ではなくエラー（"Unable to locate a Java Runtime"）が表示される。
2. 表示されなければ JDK（11以上）を入れる。入手先の例は Eclipse Temurin（https://adoptium.net/）:
   - **インストーラまたはパッケージマネージャ**: OS 用のインストーラを実行するか、OS のパッケージマネージャを使う。
     その後、新しいターミナルで `java -version` をもう一度実行する（この方法は、このガイドの作成時には実行していない）。
   - **アーカイブ（`.tar.gz`）**: 好きな場所に展開し、下の2行の `export` で場所を指定する。
3. ターミナルで実行した `export` は、そのシェルを閉じると消える。残すには、シェルの設定ファイル
   （zsh なら `~/.zshrc`）に2行を書き、新しく起動したシェルで `java -version` を確かめる。

```bash
# Archive route / アーカイブの場合。JAVA_HOME is the directory that contains bin/java:
#   macOS: <unpacked folder>/Contents/Home
#   Linux: usually the unpacked folder itself (check that $JAVA_HOME/bin/java exists)
export JAVA_HOME="$HOME/jdk-17/Contents/Home"   # replace with your real path / 実際のパスに置き換える
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

Measured on macOS with a Temurin 17 archive unpacked under the home directory: without the two
`export` lines, `java -version` and `vdmj.sh` both stop with "Unable to locate a Java Runtime"
(exit status 1); with them, both run.

macOS で、ホームディレクトリの下に展開した Temurin 17 のアーカイブで実測：この2行が無いと `java -version` も
`vdmj.sh` も "Unable to locate a Java Runtime" で止まり（終了コード1）、2行を実行すると両方とも動く。

### Step 2, Method 1: Distribution ZIP (Recommended) / 手順2・方法1：配布版ZIP（推奨）

GitHub Releases ships a `vdmj-suite-<version>-<build>-distribution.zip` containing all jars
(vdmj, annotations, stdlib, quickcheck, ...) and a `vdmj.sh` launcher script. The 4.7.0 release
lists two such archives; take the one **without** `-P` in its name
(`vdmj-suite-4.7.0-260414-distribution.zip`). Download it in a browser, then unzip it and add the
folder to PATH (this `export` lasts only for the current shell; see "Checking the Installation" below).
Unzip into a path that contains no spaces: the 4.7.0 launcher fails when its own folder path has a
space in it (measured: `ClassNotFoundException`).

GitHub Releasesには全jar（vdmj、annotations、stdlib、quickcheck等）と起動スクリプト
`vdmj.sh` を含む `vdmj-suite-<version>-<build>-distribution.zip` があります。4.7.0 のリリースには
この形の ZIP が2つあるので、名前に `-P` が**付かない**ほう（`vdmj-suite-4.7.0-260414-distribution.zip`）を
使います。ブラウザでダウンロードしてから展開し、PATHに追加します（この `export` は実行したシェルの中だけで有効。
下の「インストール後の確認」を参照）。展開先は、パスに空白を含まない場所にします（4.7.0 の `vdmj.sh` は、
自分のあるディレクトリのパスに空白があると起動に失敗する。実測：`ClassNotFoundException`）。

```bash
# 1. Download the ZIP from https://github.com/nickbattle/vdmj/releases/latest in a browser.
#    ブラウザで上のページから ZIP をダウンロードする（-P の付かないほう）。
# 2. Go to the folder where it was saved and unzip it into your home directory.
#    Use the real file name; this is the 4.7.0 file. / 保存したフォルダへ移動して展開する。
cd ~/Downloads
unzip vdmj-suite-4.7.0-260414-distribution.zip -d ~/
# 3. The ZIP creates one folder named after the version, without the build number
#    (4.7.0: ~/vdmj-suite-4.7.0). Check the name and use it in the export line.
#    展開されたフォルダ名（版が入り、ビルド番号は入らない）を確かめ、export の行で使う。
ls -d ~/vdmj-suite-*/
export PATH="$PATH:$HOME/vdmj-suite-4.7.0"
# 4. Check: this prints the VDMJ usage text. / 確認：VDMJ の使い方が表示される。
vdmj.sh -help
```

Steps 2 to 4 were run with the 4.7.0 ZIP when this guide was written (the launcher is executable
as unzipped; `vdmj.sh -help` exits with status 0). The download itself is done in the browser.

手順の 2〜4 は、このガイドの作成時に 4.7.0 の ZIP で実行して確かめた（展開した `vdmj.sh` にはそのまま
実行権限があり、`vdmj.sh -help` は終了コード0）。ダウンロードはブラウザで行う。

Alternatively, download a standalone executable jar from Maven Central
(sufficient for syntax/type check, PO generation, interpreter; QuickCheck requires the suite):

Maven Centralから単体の実行可能jarも取得可能
（構文/型チェック・PO生成・インタプリタには十分。QuickCheckにはsuiteが必要）:

```bash
mkdir -p ~/.vdmj
V=4.7.0   # VDMJ version / VDMJ の版
curl -L -o ~/.vdmj/vdmj.jar \
  "https://repo1.maven.org/maven2/dk/au/ece/vdmj/vdmj/${V}/vdmj-${V}.jar"
java -jar ~/.vdmj/vdmj.jar -v
```

### Step 2, Method 2: Build from Source / 手順2・方法2：ソースからビルド

This method needs git, Maven and a JDK, and it was not run when this guide was written. The
commands below end with a jar, not with the `vdmj.sh` launcher that `../SKILL.md` uses; prefer
Method 1 unless you need to build VDMJ yourself.

この方法には git・Maven・JDK が必要で、このガイドの作成時には実行していない。下のコマンドで得られるのは jar で、
`../SKILL.md` が使う起動スクリプト `vdmj.sh` ではない。自分でビルドする必要が無ければ方法1を使う。

```bash
git clone https://github.com/nickbattle/vdmj.git
cd vdmj
mvn install -DskipTests
# JAR is generated at vdmj/target/vdmj-*.jar
# JARは vdmj/target/vdmj-*.jar に生成される
```

## Checking the Installation / インストール後の確認

- **Java**: `java -version` must print a version (Step 1).
- **PATH**: an `export PATH=...` typed into a terminal is gone when that shell exits. To keep it,
  add the line to your shell's startup file (for zsh: `~/.zshrc`), then check in a new shell that
  `command -v vdmj.sh` prints the path.
- **Without PATH**: `vdmj.sh` also runs by its absolute path, for example
  `~/vdmj-suite-4.7.0/vdmj.sh -vdmsl file1.vdmsl`, as long as that path contains no spaces. The
  `verify-spec` skill looks for `vdmj.sh` on PATH and asks for its location when it is not found
  (`../SKILL.md`, step 1b).
- **A path with spaces**: move the folder, or run the jar inside it directly with the path in
  quotes: `java -jar "<folder>/vdmj-<version>.jar" -vdmsl file1.vdmsl` (measured: syntax/type
  check and PO generation work this way; the `qc` command is not available).
- The directory name contains the VDMJ version: use the name that `unzip` actually created.

- **Java**: `java -version` が版を表示すること（手順1）。
- **PATH**: ターミナルで実行した `export PATH=...` は、そのシェルを閉じると消える。残すには、シェルの
  設定ファイル（zsh なら `~/.zshrc`）にその行を書き、新しく起動したシェルで `command -v vdmj.sh` が
  パスを表示することを確かめる。
- **PATH を使わない場合**: `vdmj.sh` は絶対パスでも起動できる（例: `~/vdmj-suite-4.7.0/vdmj.sh -vdmsl file1.vdmsl`）。
  ただし、そのパスに空白が含まれていないこと。`verify-spec` スキルは PATH 上の `vdmj.sh` を探し、
  見つからなければ場所を尋ねる（`../SKILL.md` のステップ1b）。
- **パスに空白がある場合**: ディレクトリを移すか、その中の jar を、パスを引用符で囲んで直接実行する:
  `java -jar "<ディレクトリ>/vdmj-<版>.jar" -vdmsl file1.vdmsl`（実測：構文・型チェックと PO 生成は動く。
  `qc` コマンドは使えない）。
- ディレクトリ名には VDMJ の版が入る。`unzip` が実際に作った名前を使う。

## Command-Line Usage / コマンドラインの使い方

The commands in this section are written for the standalone jar saved as `~/.vdmj/vdmj.jar`
(`java -jar ~/.vdmj/vdmj.jar`; if your jar is elsewhere, write its full path). With the
distribution ZIP, write `vdmj.sh` in place of `java -jar ~/.vdmj/vdmj.jar`; the options are the
same, and `../SKILL.md` uses the `vdmj.sh` form.

この節のコマンドは、`~/.vdmj/vdmj.jar` に保存した単体 jar の書き方（`java -jar ~/.vdmj/vdmj.jar`。jar が別の場所に
あれば、そのフルパスを書く）。配布版ZIPの場合は `java -jar ~/.vdmj/vdmj.jar` を `vdmj.sh` に置き換える
（オプションは同じ。`../SKILL.md` は `vdmj.sh` の書き方を使っている）。

### Syntax Check + Type Check / 構文チェック + 型チェック
```bash
java -jar ~/.vdmj/vdmj.jar -vdmsl file1.vdmsl file2.vdmsl
```

### PO Generation / PO生成
```bash
java -jar ~/.vdmj/vdmj.jar -vdmsl file1.vdmsl -p
```

### Interpreter Mode / インタプリタモード
```bash
java -jar ~/.vdmj/vdmj.jar -vdmsl file1.vdmsl -i
```

### QuickCheck (Counterexample Search) / QuickCheck（反例探索）

QuickCheck is a console command (`qc` / `quickcheck`) available when the quickcheck jar
is on the classpath — `vdmj.sh` from the distribution ZIP sets this up automatically.
Note: the `-q` command-line flag is unrelated — it suppresses information messages.

QuickCheckはインタプリタのコンソールコマンド（`qc` / `quickcheck`）。quickcheck jarが
クラスパスにある必要があり、配布版ZIPの `vdmj.sh` なら自動で設定されます。
なおコマンドラインフラグの `-q` は無関係（情報メッセージ抑制）です。

```bash
# 対話モードで起動して qc を実行
vdmj.sh -vdmsl file1.vdmsl -i
> qc

# 一括実行（qcコマンドを実行して終了）
vdmj.sh -vdmsl file1.vdmsl -cmd "qc"
```

## Output Format / 出力フォーマット

### Syntax/Type Check Output / 構文・型チェック出力
```
Parsed N module(s) in X secs. No syntax errors
Type checked N module(s) in X secs. No type errors
```

When errors are found / エラーがある場合:
```
Error NNNN: Error message in 'ModuleName' (filename) at line L:C
```

### PO Output / PO出力
```
Generated N proof obligations:

Proof Obligation 1: (Unproved)
DefinitionName: POType in 'ModuleName' (filename) at line L:C
PO expression (VDM-SL)
```

PO generation (`-p`) prints every obligation as `Unproved`: it generates obligations and proves
nothing. / PO生成（`-p`）は、すべての責務を `Unproved` として出力する（生成するだけで、証明はしない）。

QuickCheck (`qc`) then prints one verdict per obligation (`PO #N, <verdict>`), as observed with
VDMJ 4.7.0 / QuickCheck（`qc`）は責務ごとに判定を1つ出力する（VDMJ 4.7.0 で確認）:

- `PROVABLE` — a QuickCheck strategy established the obligation; the line names the strategy
  (`by direct`, `by witness`, `by trivial`). / QuickCheck の戦略で成り立つことが示された（行に戦略名が付く）
- `MAYBE` — no counterexample was found; the obligation is not proved. / 反例は見つからなかった。証明されたわけではない
- `FAILED` — a counterexample was found and is printed below the verdict. / 反例が見つかった（判定の下に表示される）
- `TIMEOUT` — the check did not finish within QuickCheck's time limit. / QuickCheck の制限時間内に終わらなかった

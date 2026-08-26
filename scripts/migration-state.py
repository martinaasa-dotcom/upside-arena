"""
Which migrations a project has, worked out from what it holds.

There is no ledger table, deliberately: one more thing to keep in step, and it
lies the first time somebody runs a file by hand in the SQL editor. So each
migration is judged by whether the things it creates are there.

TWO THINGS MAKE THAT HARDER THAN IT SOUNDS, AND BOTH WERE FOUND BY GETTING
THEM WRONG.

A function is matched on its name AND its parameter count. 0026 is a `create
or replace function score_cycle`, and score_cycle has existed since 0003: on
the name alone this reports "applied" about the one migration whose absence
stops every week in the game from settling.

And a migration is only judged on the objects nothing later supersedes. 0002
creates execute_trade with six parameters; a later migration replaced it with
eight, so the six-parameter version is not in a healthy project and never will
be again. Judging 0002 on it reported four applied migrations as missing,
which is a tool crying wolf on a third of its output.

A migration that both drops and creates one name is a create: 0026 adds
score_cycle's fourth parameter and drops the three-parameter overload in the
same file.

A dropped object counts as superseded too. 0010 drops equip_title and puts
equip_cosmetic in its place, so a healthy project is supposed not to have it,
and judging 0005 on it reports a migration as missing forever.

A migration every one of whose objects has since been superseded cannot be
judged at all, and says so rather than guessing.

AND A MIGRATION CAN BE INVISIBLE TO ALL OF THAT, WHICH IS THE THIRD WRONG
ANSWER AND THE QUIETEST. Everything above judges a migration by whether the
things it creates are THERE, and a `create or replace function` that changes
only the body creates nothing new: same name, same parameter count, same row
in pg_proc. 0032 is exactly that, a one-cast fix to streak_bonus_amount, and
on presence alone it reads "applied" against a database that has never seen
it. That is the same shape as the score_cycle mistake at the top of this
note, which was caught only because 0026 happened to add a parameter. A body
replacement has nothing to add.

So when every object a migration owns was already declared, at the same
parameter count, by an earlier migration, presence cannot answer and the
BODY is compared instead. `md5(prosrc)` is what the database holds and
Postgres stores that verbatim, so it is byte-identical to the text between
the dollar quotes in the migration file: checked against all 91 function
declarations in this repository, 83 of which are live, and every one agrees.
The other eight are dropped or replaced at another arity, which is the
superseded case above and is judged there.

A body that cannot be read out of the file (no dollar quotes) is not guessed
at either: that migration says it cannot be judged.

Reads the project's inventory on stdin as whitespace-separated
`table:name`, `function:name:nargs` and `body:name:nargs:md5`, and prints one
line per migration.

With --names-only it prints just the missing ones, one per line, which is
what migrate.sh --all applies. That used to be passed through a file in the
repository root, until the test for this script overwrote it with the empty
list from a fully migrated database -- and an --all that applies nothing and
says it is done is the exact class of silent no-op this whole tool exists to
catch.
"""

import hashlib
import os
import re
import sys

CREATE = re.compile(
    r"create\s+(?:or\s+replace\s+)?(table|function)\s+(?:if\s+not\s+exists\s+)?"
    r"public\.([a-z0-9_]+)",
    re.IGNORECASE,
)

DROP = re.compile(
    r"drop\s+(table|function)\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)",
    re.IGNORECASE,
)


def parameters(sql: str, start: int) -> int:
    """How many parameters the declaration starting at `start` takes.

    Counts commas at bracket depth one, so numeric(18, 2) inside a parameter
    does not read as two parameters.
    """
    open_at = sql.find("(", start)
    if open_at == -1:
        return 0

    depth = 0
    commas = 0
    body = ""
    for i in range(open_at, len(sql)):
        ch = sql[i]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        elif ch == "," and depth == 1:
            commas += 1
        if depth >= 1:
            body += ch

    return 0 if body.strip() == "(" else commas + 1


DOLLAR = re.compile(r"\$([a-zA-Z_0-9]*)\$")


def body_after(sql: str, start: int) -> str | None:
    """The function body declared at `start`, as the file writes it.

    Postgres keeps `prosrc` exactly as it was given, so the text between the
    dollar quotes here and `md5(prosrc)` in a project agree byte for byte.
    Returns None when there are no dollar quotes to read, which is the one
    case this must not guess at.
    """
    quote = DOLLAR.search(sql, start)
    if not quote:
        return None
    opened = quote.end()
    closed = sql.find(quote.group(0), opened)
    return None if closed == -1 else sql[opened:closed]


def objects_in(path: str) -> list[str]:
    sql = open(path).read()
    seen = []
    for match in CREATE.finditer(sql):
        kind, name = match.group(1).lower(), match.group(2).lower()
        line = (
            f"table:{name}"
            if kind == "table"
            else f"function:{name}:{parameters(sql, match.end())}"
        )
        if line not in seen:
            seen.append(line)
    return seen


def bodies_in(path: str) -> dict[str, str]:
    """`function:name:nargs` to the `body:...` line that proves it is applied.

    Only functions, and only the ones this file writes a body for: a table
    has no body, and a migration judged on a table needs none.
    """
    sql = open(path).read()
    found: dict[str, str] = {}
    for match in CREATE.finditer(sql):
        if match.group(1).lower() != "function":
            continue
        name = match.group(2).lower()
        nargs = parameters(sql, match.end())
        body = body_after(sql, match.end())
        if body is None:
            continue
        digest = hashlib.md5(body.encode()).hexdigest()
        found[f"function:{name}:{nargs}"] = f"body:{name}:{nargs}:{digest}"
    return found


def drops_in(path: str) -> list[str]:
    """The things a migration deletes.

    0010 drops equip_title and puts equip_cosmetic in its place. Without this,
    0005 is judged on a function that a healthy project is supposed not to
    have, and reports as missing forever.
    """
    sql = open(path).read()
    return [f"{m.group(1).lower()}:{m.group(2).lower()}" for m in DROP.finditer(sql)]


def key(obj: str) -> str:
    """The thing itself, without its shape. Two declarations of one function
    with different parameter counts are the same object at different times."""
    parts = obj.split(":")
    return f"{parts[0]}:{parts[1]}"


def main(directory: str, names_only: bool = False) -> int:
    files = sorted(
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.endswith(".sql")
    )

    declared = {path: objects_in(path) for path in files}
    bodies = {path: bodies_in(path) for path in files}

    # What an earlier migration has already put in the schema, in the exact
    # shape presence can see. A later migration declaring one of these adds
    # nothing a project can be asked about.
    already: set[str] = set()
    unseeable: dict[str, list[str]] = {}
    for path in files:
        unseeable[path] = [obj for obj in declared[path] if obj in already]
        already.update(declared[path])

    # The last migration to say anything about an object owns its fate: the
    # shape it should have, or that it should be gone.
    owner: dict[str, tuple[str, str]] = {}
    for path in files:
        # Drops first, then creates, so that a migration doing both to one
        # name reads as a create. 0026 adds score_cycle's fourth parameter and
        # drops the three-parameter overload in the same file: its net effect
        # is that score_cycle exists, and reading that as a deletion marked
        # the migration "superseded" -- the most dangerous wrong answer this
        # can give, since it is the one whose absence stops every week in the
        # game from settling.
        for gone in drops_in(path):
            owner[gone] = (path, "drop")
        for obj in declared[path]:
            owner[key(obj)] = (path, "create")

    have = set(sys.stdin.read().split())

    behind = []
    for path in files:
        name = os.path.basename(path)[:-4]
        mine = [
            obj
            for obj in declared[path]
            if owner[key(obj)] == (path, "create")
        ]

        # A migration whose every object was already there in the same shape
        # adds nothing to find, so presence is no answer and the body is the
        # question instead. Only when EVERY object is invisible: a migration
        # that also creates a table can still be seen by the table.
        body_only = bool(mine) and all(obj in unseeable[path] for obj in mine)

        if body_only:
            proofs = [bodies[path].get(obj) for obj in mine]
            if any(proof is None for proof in proofs):
                # No body to read, so no honest answer. Saying "applied" here
                # is the failure this branch exists to prevent.
                if not names_only:
                    print(f"  {name:<62} replaces a body, cannot be judged")
                continue
            missing = [proof for proof in proofs if proof not in have]
            detail = ", ".join(
                obj.split(":", 1)[1].rsplit(":", 1)[0] for obj in mine
            )
        else:
            missing = [obj for obj in mine if obj not in have]
            detail = ", ".join(missing)

        if missing:
            behind.append(name)

        if names_only:
            continue

        if not declared[path]:
            print(f"  {name:<62} nothing to look for")
        elif not mine:
            print(f"  {name:<62} superseded")
        elif not missing:
            print(f"  {name:<62} applied")
        elif body_only:
            print(f"  {name:<62} MISSING  (body of {detail})")
        else:
            print(f"  {name:<62} MISSING  ({detail})")

    if names_only:
        for name in behind:
            print(name)
        return 0

    print()
    if behind:
        print(f"{len(behind)} missing. Apply with:")
        print("  ./scripts/migrate.sh " + " ".join(behind))
    else:
        print("Nothing missing.")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], "--names-only" in sys.argv[2:]))

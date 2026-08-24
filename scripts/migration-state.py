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

Reads the project's inventory on stdin as whitespace-separated
`table:name` and `function:name:nargs`, and prints one line per migration.

With --names-only it prints just the missing ones, one per line, which is
what migrate.sh --all applies. That used to be passed through a file in the
repository root, until the test for this script overwrote it with the empty
list from a fully migrated database -- and an --all that applies nothing and
says it is done is the exact class of silent no-op this whole tool exists to
catch.
"""

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

        missing = [obj for obj in mine if obj not in have]
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
        else:
            print(f"  {name:<62} MISSING  ({', '.join(missing)})")

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

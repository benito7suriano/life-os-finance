#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN = 54


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(lines: list[tuple[float, float, float, str]], output_path: Path) -> None:
    content_parts: list[str] = []
    for x, y, size, text in lines:
        content_parts.append("BT")
        content_parts.append(f"/F1 {size:.1f} Tf")
        content_parts.append(f"1 0 0 1 {x:.2f} {y:.2f} Tm")
        content_parts.append(f"({pdf_escape(text)}) Tj")
        content_parts.append("ET")
    content_stream = "\n".join(content_parts) + "\n"
    content_bytes = content_stream.encode("latin-1", "replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        (
            "3 0 obj\n"
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\n"
            "endobj\n"
        ).encode("ascii")
    )
    objects.append(
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )
    objects.append(
        f"5 0 obj\n<< /Length {len(content_bytes)} >>\nstream\n".encode("ascii")
        + content_bytes
        + b"endstream\nendobj\n"
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as f:
        f.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for obj in objects:
            offsets.append(f.tell())
            f.write(obj)
        xref_pos = f.tell()
        f.write(f"xref\n0 {len(objects)+1}\n".encode("ascii"))
        f.write(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            f.write(f"{off:010d} 00000 n \n".encode("ascii"))
        f.write(
            (
                f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\n"
                f"startxref\n{xref_pos}\n%%EOF\n"
            ).encode("ascii")
        )


def main() -> None:
    y = PAGE_HEIGHT - MARGIN
    line_gap = 14

    def add(size: float, text: str, extra_gap: float = 0) -> None:
        nonlocal y
        lines.append((MARGIN, y, size, text))
        y -= line_gap + extra_gap

    lines: list[tuple[float, float, float, str]] = []

    add(18, "Ledger App Summary", 6)

    add(12, "What it is", 1)
    add(10.5, "Ledger is a Next.js 16 web app for personal finance management using Supabase.")
    add(10.5, "It combines dashboard, transactions, accounts, budgets, and automation settings.", 4)

    add(12, "Who it's for", 1)
    add(
        10.5,
        "Primary persona: people tracking personal finances; product docs/metadata mention El Salvador users.",
        4,
    )

    add(12, "What it does", 1)
    add(10.5, "- Email/password sign in-up via Supabase Auth; middleware protects app routes.")
    add(10.5, "- Dashboard with KPI cards, charts, recent transactions, and quick actions.")
    add(10.5, "- Transactions: list, search, filter, sort, paginate, and create expense-income-transfer.")
    add(10.5, "- Accounts: create, edit, soft-delete, restore, and archived-view toggling.")
    add(10.5, "- Budgets and sinking funds with linked goals, contributions, and monthly history.")
    add(10.5, "- Automation channels for WhatsApp and email with connect/pause/resume/disconnect.")
    add(10.5, "- Demo fallback mode uses local sample-data JSON when API data is unavailable.", 4)

    add(12, "How it works (repo evidence)", 1)
    add(10.5, "- UI: Next.js App Router pages in app/(app) and reusable components/* sections.")
    add(10.5, "- Session/Auth: @supabase/ssr browser/server clients plus proxy middleware redirects.")
    add(10.5, "- API: /api/* route handlers validate user then run Supabase queries and mutations.")
    add(10.5, "- Data: PostgreSQL schema + RLS policies in supabase/migrations/*.sql.")
    add(10.5, "- Data flow: page fetches API -> API hits Supabase -> JSON response -> React state.")
    add(10.5, "- External bank parsing pipeline: Not found in repo.")
    add(10.5, "- Production WhatsApp verification provider integration: Not found in repo (stub endpoints).", 4)

    add(12, "How to run (minimal)", 1)
    add(10.5, "1. Install dependencies: npm install")
    add(10.5, "2. Add .env values: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    add(10.5, "   Example values and setup details: Not found in repo.")
    add(10.5, "3. Optional DB migration/seed command: Not found in repo.")
    add(10.5, "4. Start app: npm run dev, then open http://localhost:3000")

    output = Path("output/pdf/ledger-app-summary.pdf")
    build_pdf(lines, output)


if __name__ == "__main__":
    main()

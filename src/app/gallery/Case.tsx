/*
  One entry in the inventory.

  Its own file rather than page.tsx's, because the walkthrough's cases are
  rendered from a client wrapper (TourCases) and the probe finds cases by
  `data-case` — two spellings of this wrapper would be two ways for a case to
  go missing from the count. No directive: it is plain markup and belongs to
  whichever side imports it.
*/
export function Case({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <section data-case={name} className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{name}</h2>
      {children}
    </section>
  );
}

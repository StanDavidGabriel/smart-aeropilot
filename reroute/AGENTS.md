<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- The backend is Python only: `python/reroute-engine` (standard library only, Python 3.10+), run locally by the user. The Java engine was removed at the user's request; do not reintroduce it. The website has no flight logic and must call the Python service's endpoints.
- The Python service owns live AeroDataBox collection (OTP, two bounded 12h departure windows, 10-minute polling, server-only credentials), scheduled recommendations with separately labelled simulated onward schedules, SupportPolicy fares/vouchers, the sample-network Dijkstra engine, the server-side cancellation simulation store, and passenger messages; simulated schedules never enter provider snapshots.
- Flight IDs combine flight number, route and scheduled movement time so status refreshes preserve simulations; keep existing snapshot and simulation JSON field names for merge compatibility.
- Elapsed disruption starts at scheduled departure; pending or failed schedule checks never qualify for vouchers; demo amounts are never bookings, redeemable vouchers or statutory compensation.
- The database still holds `public.reroute_live_snapshots`, `public.reroute_airport_coverage`, their grants/RLS and four `reroute_*` functions from the removed hosted path, with an empty Drizzle migration set; new migrations must be additive and never re-create those objects.

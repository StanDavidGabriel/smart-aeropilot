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
- The backend exists twice with identical endpoints and JSON: `java/reroute-engine` (JDK-only) and `python/reroute-engine` (stdlib-only port); the user keeps both and runs them locally, so any rule change must be made in both and covered by both test suites. The website has no flight logic and must call these endpoints.
- Java owns live AeroDataBox collection (OTP, two bounded 12h departure windows, 10-minute polling, server-only credentials), scheduled recommendations with separately labelled simulated onward schedules, SupportPolicy fares/vouchers, the sample-network Dijkstra engine, the server-side cancellation simulation store, and passenger messages; simulated schedules never enter provider snapshots.
- Flight IDs combine flight number, route and scheduled movement time so status refreshes preserve simulations; keep existing snapshot and simulation JSON field names for merge compatibility.
- Elapsed disruption starts at scheduled departure; pending or failed schedule checks never qualify for vouchers; demo amounts are never bookings, redeemable vouchers or statutory compensation.
- The database still holds `public.reroute_live_snapshots`, `public.reroute_airport_coverage`, their grants/RLS and four `reroute_*` functions from the removed hosted path, with an empty Drizzle migration set; new migrations must be additive and never re-create those objects.

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
- Re-routing engine is authored in Java (`java/reroute-engine`, JDK-only HTTP API); `src/modules/reroute/router.ts` is a 1:1 TS mirror used as browser fallback — keep both in sync and `router.test.ts` green, because the user committed to Java and the preview cannot run a JVM.
- The reroute feature lives entirely in `src/modules/reroute` + its two routes so it can be merged into the team site without touching other modules.
- Live scheduled flights use an isolated provider normalizer and one authenticated refresh route; Cloud stores public AeroDataBox snapshots separately from manifests and simulated inventory. Hosted provider calls use the linked connector gateway with server-only credentials.
- Manual signed-in flight refresh and the managed cron route share one server-only OTP updater; signed-out users can reload public saved schedules but cannot trigger paid provider work. Manual updates invalidate both flight pages and recommendations without changing local cancellations.
- Live collection is fixed to OTP using two bounded provider windows; public reads and Java lists filter OTP origins and enforce future-departure eligibility. Legacy regional collection remains inert so old activation flags cannot enable paid multi-airport fetching.
- The Java service exposes the same normalized scheduled-flight feed using server environment credentials; Java routing and its TS fallback stay on the identical demo network because the live feed does not supply passenger manifests or bookable seats.

- Flight cancellation and restoration use the isolated browser-local simulation store with cross-tab synchronization and synthetic recipients; flight IDs combine flight number, route and scheduled movement time so status refreshes preserve scenarios without merging different dates. Retain the existing snapshot and simulation DTO names for merge compatibility.
- The live Ops and passenger routes use the simulation store, while the standalone Java routing engine and its TS mirror remain available for team integration with real schedule/manifest inputs.
- Scheduled recommendations combine real OTP pages with deterministic, separately labelled simulated onward schedules through a Java selector and identical browser fallback. Simulated schedules never enter provider snapshots or cancellation rows; no extra provider calls or booked-seat guarantees are allowed.
- Scheduled-fare estimation and no-route voucher assessment use isolated SupportPolicy Java logic with a matching browser fallback; elapsed disruption starts at scheduled departure, and failed or pending schedule checks cannot qualify passengers. Demo amounts never constitute bookings, redeemable vouchers or statutory compensation.

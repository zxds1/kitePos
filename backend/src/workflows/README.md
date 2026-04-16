# Custom Workflows

A workflow is a series of queries and actions that complete a task.

The workflow is created in a TypeScript or JavaScript file under the `src/workflows` directory.

> Learn more about workflows in [this documentation](https://docs.medusajs.com/learn/fundamentals/workflows).

For example:

```ts
import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk"

const step1 = createStep("step-1", async () => {
  return new StepResponse(`Hello from step one!`)
})

type WorkflowInput = {
  name: string
}

const step2 = createStep(
  "step-2",
  async ({ name }: WorkflowInput) => {
    return new StepResponse(`Hello ${name} from step two!`)
  }
)

type WorkflowOutput = {
  message1: string
  message2: string
}

const helloWorldWorkflow = createWorkflow(
  "hello-world",
  (input: WorkflowInput) => {
    const greeting1 = step1()
    const greeting2 = step2(input)
    
    return new WorkflowResponse({
      message1: greeting1,
      message2: greeting2
    })
  }
)

export default helloWorldWorkflow
```

## Execute Workflow

You can execute the workflow from other resources, such as API routes, scheduled jobs, or subscribers.

For example, to execute the workflow in an API route:

```ts
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework"
import myWorkflow from "../../../workflows/hello-world"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { result } = await myWorkflow(req.scope)
    .run({
      input: {
        name: req.query.name as string,
      },
    })

  res.send(result)
}
```



I scanned the product codebase, excluding vendored Flutter SDK files, build outputs, `node_modules`, `.dart_tool`, and generated files.

**Report**
- High: Route drift and dead aliases are already baked into the app navigation. `salesEntry` is just an alias of `sales`, `restock` routes to `RestockHistoryScreen`, and `analyticsDashboard` is effectively treated as `reports` in shell state while its screen also sets `currentRoute` to `reports`. That creates multiple names for the same surface and at least one miswired entrypoint. See [`routes.dart`](/home/sugho/UZApoint/uza_pos/lib/config/routes.dart#L63), [`routes.dart`](/home/sugho/UZApoint/uza_pos/lib/config/routes.dart#L71), [`routes.dart`](/home/sugho/UZApoint/uza_pos/lib/config/routes.dart#L149), [`analytics_dashboard_screen.dart`](/home/sugho/UZApoint/uza_pos/lib/features/analytics/screens/analytics_dashboard_screen.dart#L51), and [`app_shell.dart`](/home/sugho/UZApoint/uza_pos/lib/core/widgets/app_shell.dart#L636).
- High: The backend billing layer is now a real integration boundary. [`billing.service.ts`](/home/sugho/UZApoint/backend/src/services/billing.service.ts#L1) is Stripe-backed, partner onboarding provisions customers, and partner exports are billed through the same service boundary.
- Medium: There are leftover wrapper screens that add indirection without behavior. [`ProductsScreen`](/home/sugho/UZApoint/uza_pos/lib/features/products/screens/products_screen.dart#L4) only returns `ProductListScreen`, and [`SalesEntryScreen`](/home/sugho/UZApoint/uza_pos/lib/features/sales/screens/sales_entry_screen.dart#L4) only returns `SalesScreen`. These look like rename leftovers.
- Medium: Onboarding state is duplicated in two places. [`app.dart`](/home/sugho/UZApoint/uza_pos/lib/app.dart#L84) and [`onboarding_screen.dart`](/home/sugho/UZApoint/uza_pos/lib/features/auth/screens/onboarding_screen.dart#L19) both hardcode `onboarding_complete`. Centralizing that key would reduce drift risk.
- Medium: The codebase still has a lot of unfinished scaffolding. In `uza_pos/lib/features`, the `providers` and `widgets` subfolders for `auth`, `home`, `products`, `reports`, `restock`, `sales`, and `settings` contain only `.gitkeep`. That usually means planned modularization that never got filled in, or modules that were started and abandoned.
- Medium: The biggest Flutter files are monoliths, not modules. The worst hotspots are `branch_management_screen.dart` 2068 lines, `loyalty_program_screen.dart` 1851, `product_form_screen.dart` 1777, `sales_assistant_screen.dart` 1454, `sales_photo_entry_screen.dart` 1408, `supplier_directory_screen.dart` 1346, `tax_reporting_screen.dart` 1272, `returns_portal_screen.dart` 1074, `ai_config_screen.dart` 1007, `analytics_dashboard_screen.dart` 997, `app_shell.dart` 775, `auth_provider.dart` 796, and `sync_service.dart` 890. These files mix UI, state, formatting, business rules, and API orchestration.
- Medium: The backend has the same shape problem. Major files include `tax.service.ts` 938 lines, `loyalty.service.ts` 761, `api/pos/analytics/_shared.ts` 658, `api/admin/products/_utils.ts` 633, and `api/admin/products/route.ts` 437. These are doing too much and are harder to test or change safely.
- Low to medium: Documentation drifts from reality. [`backend/README.md`](/home/sugho/UZApoint/backend/README.md#L1) is still Medusa-starter oriented, not UZApoint-specific, and the backend docs still need a focused billing/payment architecture note alongside the app guide.
- Low to medium: Test coverage is thin relative to the surface area. The Flutter app has 9 tests total, concentrated in sales and a few unit cases. The backend has 6 tests, mostly around AI matching/extraction. Auth, routing, settings, restock, sync, and the major settings screens are under-covered.

**What this means**
- The codebase is functional, but it has accumulated route churn, leftover compatibility layers, and large multi-responsibility files.
- The biggest payoff is not “delete random code”; it is to normalize the app surface, remove dead compatibility paths, then split the heavy files into smaller units with explicit ownership.
- The `partner-portal` is comparatively small and did not show obvious TODO/stub debt in the scan. It is not the first refactor target.

**Plan**
1. Normalize navigation first.
- Pick one canonical route for each major surface: sales, inventory, restock, analytics, settings.
- Remove or repoint dead aliases like `salesEntry`, `restock`, and the duplicate analytics dashboard path.
- Delete the wrapper screens once nothing depends on them.

2. Build a feature inventory.
- Tag every screen, provider, service, and backend module as `active`, `partial`, `stub`, `duplicate`, or `dead`.
- Include the `.gitkeep` scaffolds and doc-only placeholders.
- Use this as the source of truth before any deletion.

3. Split the worst monoliths.
- Frontend first: `product_form_screen`, `sales_assistant_screen`, `sales_photo_entry_screen`, `branch_management_screen`, `loyalty_program_screen`, `tax_reporting_screen`, `returns_portal_screen`, `app_shell`, `auth_provider`, `sync_service`.
- Backend second: `tax.service.ts`, `loyalty.service.ts`, `api/pos/analytics/_shared.ts`, `api/admin/products/_utils.ts`, and the biggest route handlers.
- Extract pure domain logic into services/use-cases and keep screens thin.

4. Remove or formalize stubs.
- Billing is real. Keep the service as the Stripe-backed integration boundary, use it from the partner onboarding flow, and remove any remaining stub response shapes.
- Do the same for any placeholder flows in the implementation guide, especially payment-related ones.

5. Tighten state and persistence.
- Centralize shared keys like `onboarding_complete`, `auth_session`, and preference keys.
- Move ad hoc persistence logic into one settings/auth layer so state does not drift across screens.

6. Add tests at the seams.
- Add route tests for navigation aliases and shell highlighting.
- Add service tests for billing, sync, onboarding persistence, and auth restore.
- Add a few screen-level tests for the highest-risk entrypoints: login, product form, restock, and analytics.

7. Refresh docs last.
- Rewrite the backend README to reflect the real UZApoint topology.
- Add a short “feature status” document so incomplete surfaces are explicit instead of implicit.
- Remove guide snippets that still show placeholder TODOs unless they are truly planned work.

If you want, I can turn this into a prioritized refactor backlog next, or start with phase 1 and clean up the route/dead-code layer first.s

# Plan

1. Keep the existing build and workflow policy from #38.
2. Replace the upload and purge steps with one official deploy-site action.
3. Pin CLI 0.20.0: its file collector includes .well-known and create supports --from-zone.
4. Reuse BUNNY_API_KEY; configure the imported site via the production BUNNY_SITE variable.
5. Document operator-controlled import of existing EU resources and verify publication separately.
6. Test workflow structure/policy locally; leave live deployment smoke checks to the operator.

## Constitution check

I–III: No dataset, evidence, protocol or scanner changes.
IV: Static output remains repository-built; no new backend.
V: No rendered UI or browser changes.
VI: Spec, plan, tests and operator documentation accompany implementation.
VII: Import preserves existing EU storage and CDN resources; no new service or collection.

No deviations. PR targets main and depends on merging #38 first.

# ClauseBank build source

`clauses.txt` is the only manually maintained source for ClauseBank clause data. It is deliberately served as plain text, not an extra indexable HTML page. It was bootstrapped byte-for-byte from the approved 98-card `/clausebank/` landing page at `ca99b687`. Each `<article>` records its code, category/search terms, Chinese and English titles, applicability, short/long mode, Chinese and English clause bodies, and the existing semantic URL. The top filter block is the canonical category list. The `homepage-order` comment records the separately approved homepage presentation order; it does not duplicate clause text.

The homepage, `/clausebank/`, and semantic HTML pages are **generated output**. Do not edit clause data in them. The homepage keeps its own cardhead presentation/onclick structure, while standalone ClauseBank pages use the standalone cardhead. Both get the same clause fields and body from `clauses.txt`. The generator changes only ClauseBank filter/card markup in existing indexed pages: existing `<head>`, H1, URL, and deep-link code remain untouched.

To add a 99th clause, edit only `clauses.txt`: add one complete card with a unique code, finalized content, category/mode, and semantic `<a href>` (plus a filter button there if it is a new category). Then run:

```sh
python3 scripts/build_clausebank.py
python3 scripts/validate_clausebank.py --expected-count 99
```

The build creates a new semantic page and appends its URL to `sitemap.xml`; it does not rewrite existing pages' SEO metadata. Review the new page's generated metadata against the finalized clause before release. For an existing clause, keep its semantic slug unchanged.

The build also stamps every ClauseBank JS reference with a content hash so a deployment cannot keep an old cached implementation after the shared script changes. This has no visible effect and is not SEO metadata.

The four service pages are outside the ClauseBank generator. Their old hidden ClauseBank copies were removed; their visible content and interaction scripts remain. `scripts/remove_hidden_service_clausebank.py` and `scripts/dedupe_home_clausebank_behavior.py` document the one-time migration and are not part of the ongoing build.

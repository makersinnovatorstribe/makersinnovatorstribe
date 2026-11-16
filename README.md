# Makers Innovators Tribe website

Live website: https://makersinnovatorstribe.github.io/makersinnovatorstribe/

## Routine content updates

Edit the **EXCOs** or **Posters** tabs in [MIT Website CMS](https://docs.google.com/spreadsheets/d/1x5CEa2gl82lhE2vC7jAWhwjtb8putm0vlBCNZ0s5qUk/edit). Instructions are beside each table. These public spreadsheet updates do not require a code change or redeployment. The site checks for updates every 60 seconds while visible; Google may take a few minutes to republish.

Use a direct public HTTPS image URL for new photographs and posters. Images in this repository already have working paths. Private Drive links and laptop file paths cannot be displayed to public visitors. Only publish content intended for the website.

## Code and design updates

Push changes to `main`. The **Publish MIT website** GitHub Actions workflow builds the optimized public `site` folder, checks asset references, and deploys GitHub Pages. No Node packages are required.

```sh
node scripts/build-site.cjs --output site --site-url https://makersinnovatorstribe.github.io/makersinnovatorstribe/
node scripts/verify-site.cjs --root site
```

Runtime source remains unbundled for editing; delivery CSS/JavaScript are compacted during the build. Local manual editor drafts, editor servers, original source photographs, and private backend experiments are maintained separately in the local working project and are not part of this release.

## Remaining follow-up

- All eleven profile write-ups are complete, including Wei Shen's details supplied on 16 November 2026.
- November posters are current: Leather Journal Cover on 17 November, 5–8pm; Tufted Mirror on 13 and 20 November, 1–5pm. Each date has its own automatic archive cutoff.
- Further phone performance tuning and real iPhone/Android testing remain. Current release checks are browser simulations, not a physical-phone guarantee.
- The local completion dashboard still uses bundled profile data rather than the live spreadsheet.

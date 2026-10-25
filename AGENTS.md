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

## Application architecture
- Use a shared BusinessProvider for the public demo and owner-private Cloud workspace, so demo interactions never write another user's data.
- Keep each business module in a distinct TanStack route and reuse the application shell, so navigation and page metadata remain consistent.
- Persist owner business records as a versionable workspace JSON document behind owner-scoped RLS for this MVP; normalize records before implementing employee permissions or high-volume concurrent sales.
- Keep payment methods as manually recorded payments until provider verification is integrated; never present them as automatically confirmed.

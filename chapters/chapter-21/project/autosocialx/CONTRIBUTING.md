# Contributing to AutoSocialX

First off, thank you for considering contributing to AutoSocialX! It's people like you that make AutoSocialX such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, check this repository's Issues page first to see if someone else has already created a ticket. If not, go ahead and make one!

## Setting up your local environment

1. **Fork the repo** and clone it locally.
2. **Install PNPM**: This project uses PNPM workspaces.
3. **Install dependencies**: Run `pnpm install` in the root directory.
4. **Start the development server**:
   ```bash
   pnpm dev
   ```

## Creating a Pull Request (PR)

1. **Branch out**: Create a new branch `git checkout -b feature/your-feature-name` or `fix/your-bugfix-name`.
2. **Commit conventional**: We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Please make sure your commit messages are descriptive.
3. **Run tests & lint**:
   ```bash
   pnpm lint
   ```
4. **Push & PR**: Push the code to your fork and submit a PR against the `main` branch. Fill out the PR template provided completely.

## Architecture

Please review `docs/ARCHITECTURE.md` before making any significant structural changes.

Thank you for contributing! 🚀

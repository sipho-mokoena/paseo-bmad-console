# Changelog

All notable changes to Paseo BMAD Console are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- Removed authentication entirely (login, sign-up, sessions, users, roles, admin area, profile page, GitHub OAuth, dev bypass). The app is single-tenant and has no login: run it on localhost or a private network. GitHub projects are added by `owner/name` and read with the optional `GITHUB_PAT`. Migration `remove_auth` keeps the registered projects and drops the auth tables.
- First standalone release, forked from bmad-code-org/bmad-method-ui (see NOTICE).

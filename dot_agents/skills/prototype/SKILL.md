---
name: prototype
description: How to prototype different solutions preferred by the user. Focus on alternatives and varying designs.
disable-model-invocation: true
---

This is the established path for how to establish and present prototypes. Used when the user wants different alternatives to choose between. Primarily used for different frontend design alternatives.

1. Use a temporary directory that is gitignored like .tmp/
2. Think about the data model and establish a shared preset available for all pages.
3. Establish a shared previewer, all sites should be available on the same url.
4. The shared previewer should follow a carousel format for navigating between the different designs easily.
5. Create 5 varying designs of the user flow, all should have the same styling format, default to the style of the current repository. If the user specifies an amount of designs use that instead.
6. Serve the "application" so it outlives your session (systemd user unit or the project's long-job helper, never a plain background process), bound to 127.0.0.1. Give the user a DNS name, never a raw IP, so the link keeps working when the host moves.
7. Give the user the names of each design and mention what else could be implemented for a suggested follow up.

The goal of this skill is to explore alternatives of a user flow for interacting with an application. 

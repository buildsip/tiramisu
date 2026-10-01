---
title: Compatibility
icon: Puzzle
---

## Supported agents

Tiramisu automatically adds the MCP tools to these agents.

If your agent harness isn't on this list, you might still be able to install the MCP and skill [manually](./01-installation.md#manual-installation).

| Agent                  |
| ---------------------- |
| Antigravity            |
| Cline VSCode Extension |
| Cline CLI              |
| Claude Code            |
| Codex                  |
| Cursor                 |
| fx                     |
| Gemini CLI             |
| Goose                  |
| GitHub Copilot CLI     |
| Grok Build             |
| Kilo Code              |
| Kimi Code              |
| Kiro CLI               |
| OpenCode               |
| Pi                     |
| VS Code                |
| Windsurf               |
| Zed                    |

## Supported languages

Tiramisu recognizes package and project directories by the manifest files below.

| Language                                                                                                                         | Manifest file                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Ada ([Alire](https://alire.ada.dev/docs/))                                                                                       | `alire.toml`                                  |
| Ballerina                                                                                                                        | `Ballerina.toml`                              |
| C / C++ (vcpkg / [Conan](https://docs.conan.io/2/reference/conanfile_txt.html))                                                  | `vcpkg.json`, `conanfile.py`, `conanfile.txt` |
| C#                                                                                                                               | `*.csproj`                                    |
| Clojure                                                                                                                          | `deps.edn`, `project.clj`                     |
| Crystal                                                                                                                          | `shard.yml`                                   |
| D                                                                                                                                | `dub.json`, `dub.sdl`                         |
| Dart / Flutter                                                                                                                   | `pubspec.yaml`                                |
| Elixir                                                                                                                           | `mix.exs`                                     |
| Elm                                                                                                                              | `elm.json`                                    |
| Erlang (Rebar3)                                                                                                                  | `rebar.config`                                |
| F#                                                                                                                               | `*.fsproj`                                    |
| Fortran                                                                                                                          | `fpm.toml`                                    |
| Gleam                                                                                                                            | `gleam.toml`                                  |
| Go                                                                                                                               | `go.mod`                                      |
| Haskell ([Cabal](https://cabal.readthedocs.io/en/stable/cabal-package-description-file.html))                                    | `*.cabal`                                     |
| Haxe                                                                                                                             | `haxelib.json`                                |
| Java / Kotlin / Scala (Maven / [Gradle](https://docs.gradle.org/current/userguide/multi_project_builds.html), including Android) | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| JavaScript / TypeScript                                                                                                          | `package.json`                                |
| Julia                                                                                                                            | `Project.toml`, `JuliaProject.toml`           |
| Lua (LuaRocks)                                                                                                                   | `*.rockspec`                                  |
| Move                                                                                                                             | `Move.toml`                                   |
| Nim                                                                                                                              | `*.nimble`                                    |
| OCaml                                                                                                                            | `opam`, `*.opam`                              |
| PHP                                                                                                                              | `composer.json`                               |
| PureScript (Spago)                                                                                                               | `spago.yaml`, `spago.dhall`                   |
| Python                                                                                                                           | `pyproject.toml`, `setup.py`                  |
| R                                                                                                                                | `DESCRIPTION`                                 |
| Raku                                                                                                                             | `META6.json`                                  |
| Ruby (RubyGems / [Bundler](https://bundler.io/guides/gemfile.html))                                                              | `*.gemspec`, `Gemfile`                        |
| Rust                                                                                                                             | `Cargo.toml`                                  |
| Swift                                                                                                                            | `Package.swift`                               |
| Typst                                                                                                                            | `typst.toml`                                  |
| V                                                                                                                                | `v.mod`                                       |
| Visual Basic .NET                                                                                                                | `*.vbproj`                                    |
| Zig                                                                                                                              | `build.zig.zon`                               |

`*` stands for the package or project name, such as `billing.csproj` or `parser.cabal`.

Gradle projects are detected when their directory contains `build.gradle` or `build.gradle.kts`. Tiramisu does not evaluate Gradle settings, so subprojects without either file or with a custom build filename aren't supported.

# Build deliveries locally
In the project root:

| Platform | Architecture | Application | Build command |
| --- | --- | --- | --- |
| macOS | x86\_64 | Desktop / Electron app | `./bin/build-mac-x64.sh` |
| ARM 64 | Desktop / Electron app | `./bin/build-mac-arm64.sh` |     |
| Linux | x86\_64 | Desktop / Electron app | `./bin/build-linux-x64.sh` |
| Server | `./bin/build-server.sh` |     |     |
| Windows | x86\_64 | Desktop / Electron app | `./bin/build-win-x64.sh` |

Under NixOS the following `nix-shell` is needed:

```
nix-shell -p jq
```

For Linux builds:

```
nix-shell -p jq fakeroot dpkg
```

The resulting build will be in the `dist` directory under the project root.

### Testing the Linux builds under NixOS

<table><thead><tr><th>Desktop client</th><th>Server</th></tr></thead><tbody><tr><td><pre><code class="language-text-plain">$ NIXPKGS_ALLOW_UNFREE=1 nix-shell -p steam-run
[nix-shell] cd dist/trilium-linux-x64
[nix-shell] steam-run ./trilium</code></pre></td><td><pre><code class="language-text-plain">$ NIXPKGS_ALLOW_UNFREE=1 nix-shell -p steam-run
[nix-shell] cd dist/trilium-linux-x64-server
[nix-shell] steam-run ./trilium.sh</code></pre></td></tr></tbody></table>
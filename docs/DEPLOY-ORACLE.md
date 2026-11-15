# Hosting the full site on Oracle Cloud (free)

This runs everything (site, sign-in, ASTRA chat on Qwen 2.5 3B, body-map triage on MedGemma 1.5 4B, ElevenLabs voice) on an Oracle Cloud **Always Free** server. A Cloudflare Tunnel puts it on your own subdomain with HTTPS, so no ports need opening.

**Cost:** $0 within the Always Free limits. Sign-up needs a card for verification.
**Time:** about an hour, mostly waiting for the models to download.

The static preview on Cloudflare Pages (`build-static.js`) keeps working separately. This server is the full version.

## 1. Sign up

1. Sign up at https://www.oracle.com/cloud/free/.
2. Pick your **home region** carefully, because you can't change it later. Choose one near you. If it later says "out of capacity" when creating the server, try again at another time of day.
3. Optional but recommended: in **Billing → Upgrade and manage payment**, upgrade to **Pay As You Go**. Always Free resources stay free, and Oracle no longer reclaims idle free servers. Set a budget alert at $1 so nothing surprises you.

## 2. Create the server

Go to **Compute → Instances → Create instance**:

| Setting | Value |
|---|---|
| Name | `astrasight` |
| Image | **Change image → Canonical Ubuntu 24.04** (the aarch64 one) |
| Shape | **Change shape → Ampere → VM.Standard.A1.Flex**, 2 OCPUs, 12 GB memory (the "Always Free-eligible" label must show) |
| Networking | defaults (public IPv4 on, for SSH) |
| SSH keys | **Generate a key pair for me** → **Save private key** |
| Boot volume | default (about 47 GB) is enough |

Click **Create**, wait for **Running**, and copy the **Public IP address**.

The free ARM allowance was cut to 2 OCPUs / 12 GB in June 2026. If the console still offers 4 / 24, stay at 2 / 12 so it remains free.

## 3. Create the Cloudflare Tunnel

1. In Cloudflare, go to **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, and name it `astrasight`.
2. Under **Install connector**, the commands contain a long token starting with `eyJ`. Copy just the token.
3. Under **Public hostname**, set:
   - Subdomain: `app` (or any name you like)
   - Domain: your domain
   - Service: `HTTP`, `localhost:8000`
4. Save. The hostname goes live once the server connects in step 4.

## 4. Run the setup script

From PowerShell on your PC (the key file is the one you saved in step 2):

```powershell
ssh -i "$HOME\Downloads\ssh-key-XXXX.key" ubuntu@<PUBLIC_IP>
```

If SSH refuses with "bad permissions", fix the key file once and retry:

```powershell
icacls "$HOME\Downloads\ssh-key-XXXX.key" /inheritance:r /grant:r "$($env:USERNAME):R"
```

On the server, paste:

```sh
curl -fsSL https://raw.githubusercontent.com/DoctorBeryl/NasaSpaceApps26/main/deploy/oracle-setup.sh -o setup.sh
TUNNEL_TOKEN=eyJ...your-token... bash setup.sh
```

At the end it prints `/api/ai/status`, which should show `"modelReady": true` and `"medModelReady": true`. Open `https://app.<your-domain>`.

## 5. Finish

- **Firebase sign-in:** in the Firebase console, go to **Authentication → Settings → Authorized domains** and add `app.<your-domain>`.
- **Firebase service account (optional):** without it, face sign-in runs in local mode on the server. To use it, copy the JSON over from your PC with `scp -i <key> <file>.json ubuntu@<IP>:/opt/astrasight/`. Then add `FIREBASE_SERVICE_ACCOUNT=./<file>.json` to `/opt/astrasight/.env` and run `sudo systemctl restart astrasight`.
- **Updates:** the server pulls `main` every minute and restarts when something changed. To freeze the site (for example after submission), run `sudo systemctl disable --now astrasight-update.timer`.
- **Adding a model:** add a line `OLLAMA_<NAME>_MODEL=<ollama tag>` to `.env.example` and push. Within a minute the server pulls the model and restarts. `astrasight-models` lists what it will pull. Up to 3 models stay loaded at once (`OLLAMA_MAX_LOADED_MODELS=3`). Check memory before adding big ones: the Google Cloud e2-standard-4 has 16 GB, and Qwen 3B plus MedGemma 4B use about 6 GB.

## Day-to-day

| Task | Command |
|---|---|
| Live server log | `journalctl -u astrasight -f` |
| Model log | `journalctl -u ollama -f` |
| Restart | `sudo systemctl restart astrasight` |
| Update now | `sudo systemctl start astrasight-update` |
| Models present | `ollama list` |
| Change settings | `nano /opt/astrasight/.env`, then restart |

## Notes

- **Speed:** CPU only. Expect chat replies in a few seconds and MedGemma triage in roughly 20–40 s. Both models stay loaded (`OLLAMA_KEEP_ALIVE=-1`), so there's no cold start.
- **Idle reclaim:** Oracle may reclaim Always Free servers that are idle for 7 days. Keeping both models in memory helps, and Pay As You Go removes the risk.
- **Face templates** stay on this server in `/opt/astrasight/server/data/faces.json`. Crew enrolled on a laptop must enroll again here.
- **Security:** Ollama listens only on `127.0.0.1`. Don't open ports 8000 or 11434 in Oracle's security list. The tunnel doesn't need them.

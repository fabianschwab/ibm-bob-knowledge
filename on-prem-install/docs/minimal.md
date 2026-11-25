# Minimalanforderungen: Bob Self-Hosted (komplett on-premises, inkl. Modelle)

Quellen: [System requirements](https://bob.ibm.com/docs/ide/enterprise/on-premises/system-requirements), [Supported models](https://bob.ibm.com/docs/ide/enterprise/on-premises/model-gateway/supported-models) und [vLLM runtime](https://bob.ibm.com/docs/ide/enterprise/on-premises/model-gateway/vllm-runtime). Die Modellseiten habe ich zusätzlich herangezogen, weil die System-Requirements-Seite die Modelle ausdrücklich ausklammert.

## 1. Plattform (Bob Core)

| Punkt | Anforderung |
|---|---|
| Bob self-hosted | 2.0.0 |
| Bob IDE / Shell | 2.2.0 / 2.0.5 |
| Premium Package (optional) | IBM Bob Premium Package for Z 3.1.0 |
| Plattform | Kundenverwalteter OpenShift (OCP) 4.20, 4.21 oder 4.22 |
| Architektur | amd64 (x86_64) für alle Worker, die Bob-Workloads ausführen |
| Gemischte Cluster | Erlaubt, wenn Bob per Node-Selector oder Taints auf amd64 beschränkt wird. Bob setzt das nicht automatisch. |

## 2. Cluster-Minimum (Bob Core, 9 Knoten)

| Rolle | Anzahl | CPU/Knoten | RAM/Knoten |
|---|---|---|---|
| Control Plane | 3 | 4 vCPU | 16 GiB |
| Infrastructure | 3 | ca. 4 vCPU | ca. 16 GiB |
| Worker | 3 | 8 vCPU | 16 GiB (200 GiB Storage je Worker) |
| **Gesamt** | **9** | ca. 48 vCPU | ca. 144 GiB RAM, 600 GiB Storage |

**Bob-Core-Footprint**
- Angefragte Ressourcen: 10,8 vCPU, 10,8 GiB RAM, ca. 24 GiB PVs.
- Mit 25 % Scheduling-Headroom: ca. 13,5 vCPU und ca. 13,5 GiB RAM.

**Optionale Add-ons** (nur bei IBM-Z-Funktionen nötig)

| Konfiguration | CPU | RAM | Storage |
|---|---|---|---|
| Core + Z Context tool | 27,8 vCPU | 45,8 GiB | ca. 55 GiB |
| Core + Z Understand | 18,8 vCPU | 49,8 GiB | ca. 24 GiB |
| Core + beide | 35,8 vCPU | 84,8 GiB | ca. 55 GiB |

## 3. Storage

- **Unterstützte Storage-Klassen:** Managed NFS (RWO und RWX) oder OpenShift Data Foundation (RWO und RWX).
- **PostgreSQL, OpenSearch, Redis:** RWO. SSD-Blockspeicher wird dringend empfohlen, vor allem für PostgreSQL und OpenSearch.
- **Gemeinsame Konfiguration und Zertifikate:** RWX.
- **Backup:** Ein separates Ziel ist nötig, zum Beispiel NFS, ein Enterprise-Backup-Repository oder Object Storage. Es muss App-Backups, DB-Backups, Index-Snapshots und Retention-Kopien aufnehmen.

## 4. Netzwerk

- Die OpenShift-Knoten erreichen sich gegenseitig.
- Ihre Workstation erreicht die OpenShift-API.
- Bob erreicht die LLM-Endpunkte und, falls genutzt, LDAP oder Active Directory.
- Clients erreichen den Bob-Ingress.
- DNS-Einträge für den Bob-Endpunkt sind gesetzt.
- Die TLS-Zertifikate sind von den Clients aus validierbar.

Für Air-Gap-Betrieb muss außerdem eine interne Container-Registry vorhanden sein. Die Doku nennt Container-Registries als Verbindungsziel, beschreibt aber kein Mirroring.

## 5. Modelle (on-premises / air-gapped)

Die Modelle sind **nicht** im Bob-Footprint enthalten. Bob stellt sie nicht bereit und betreibt sie nicht. Ihr braucht dafür eine eigene Serving-Plattform, zum Beispiel vLLM, OpenShift AI oder run.ai. Diese muss einen **OpenAI-kompatiblen Endpunkt** liefern, der vom Cluster aus erreichbar ist.

**Erforderlich sind zwei Rollen:**
1. **Genau ein Core-Inference-Modell.** Mehrere gleichzeitig werden nicht unterstützt. Zur Auswahl stehen:
   - Nvidia Nemotron 3 Ultra (FP8 oder NVFP4)
   - Nvidia Nemotron 3.5 Super (NVFP4)
   - Poolside Laguna S 2.1 (FP8 oder NVFP4)
   - Mistral Medium 3.5. Das ist nur mit dem Premium Package for Z erlaubt.
2. **Guardrail-Modell `openai/gpt-oss-20b`.** Es wird für Air-Gap dringend empfohlen. Die Doku führt es als "Required for safety and policy screening".

**GPU-Hardware:** Die Doku nennt keine feste Mindest-GPU. Sie verweist auf die Hersteller-Dokumentation, weil der Bedarf von Quantisierung, Kontextlänge, Runtime und Durchsatz abhängt. Die einzigen belegten Referenzwerte stammen aus den vLLM-Tests von IBM:
- **Getestet auf:** NVIDIA H200 GPUs.
- **Nemotron 3 Ultra, Laguna S 2.1 und Mistral Medium 3.5:** Tensor-Parallel 8, also 8 GPUs pro Modellinstanz.
- **Nemotron 3 Ultra:** `--max-model-len=262144`, `--max-num-seqs=32`, `--gpu-memory-utilization=0.90`.
- **Token-Limits:** 262.144 bis 270.000 Input-Tokens und 20.000 Output-Tokens.
- **Nur Text:** Bilder und multimodale Eingaben werden nicht unterstützt.

Die Doku nennt keine Mindestanforderung für `gpt-oss-20b`. Dieses Modell ist deutlich kleiner als die Core-Modelle, braucht aber ebenfalls eine eigene GPU-Kapazität.

## Fazit

- **Cluster:** Das Minimum ist ein 9-Knoten-OCP-Cluster auf amd64 mit etwa 48 vCPU, 144 GiB RAM und 600 GiB Storage. Das gilt nur für Bob Core ohne Z-Add-ons.
- **Modelle:** Zusätzlich braucht ihr eine separate GPU-Infrastruktur. Als einzige belegte Referenz gelten 8× H200 für ein Core-Modell, plus Kapazität für `gpt-oss-20b`.
- **Offen:** Konkrete Mindest-GPUs für ein kleineres Setup stehen nicht in der Doku. Die müsstet ihr bei IBM erfragen oder selbst per Lasttest ermitteln.
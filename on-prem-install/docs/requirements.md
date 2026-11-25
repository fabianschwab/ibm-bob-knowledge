# IBM Bob On-Premises: Min- und Empfehlungssizing

**Wichtig:** Bob braucht immer einen erreichbaren Inference-Endpunkt für ein Core-Modell. „Ohne Inference Server“ heißt hier: **kein lokaler Model-Serving-Server**. Der Endpunkt muss dann extern bereitgestellt werden, etwa durch einen Cloud-Anbieter oder eine vorhandene Modellplattform. [IBM: Installationsvoraussetzungen](https://bob.ibm.com/docs/ide/enterprise/on-premises/installation/prerequisites)

## 1. Minimal: Single Node OpenShift mit Bob Core

Red Hat nennt für OpenShift 4.20 auf einem einzelnen Node mindestens 8 vCPU, 16 GB RAM und 120 GB Speicher. Bob Core benötigt zusätzlich 10,8 vCPU, 10,8 GiB RAM und etwa 24 GiB persistenten Speicher. IBM weist darauf hin, dass diese Bob-Werte den OpenShift-Aufwand nicht enthalten. [Red Hat: Single Node OpenShift](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/installing_on_a_single_node/preparing-to-install-sno) · [IBM: Bob-Sizing](https://bob.ibm.com/docs/ide/enterprise/on-premises/system-requirements)

| Einzelner SNO-Node | CPU | RAM | Speicher |
|---|---:|---:|---:|
| OpenShift-Mindestwert | 8 vCPU | 16 GB | 120 GB |
| Bob Core | 10,8 vCPU | 10,8 GiB | ca. 24 GiB persistent |
| **Grobe rechnerische Summe** | **ca. 19 vCPU** | **ca. 27 GB** | **mindestens ca. 144 GB** |

Das ist eine **addierte Untergrenze zur Planung**, keine von IBM dokumentierte SNO-Konfiguration für Bob. Auf einem einzelnen Server konkurrieren OpenShift und Bob um dieselben Ressourcen; die Summe bietet kaum Reserve. Für einen Test mit sehr geringer Nutzung kann sie als Ausgangspunkt dienen. Der Node hat keine Hochverfügbarkeit.

## 2. Empfohlene OpenShift-/Bob-Installation ohne lokalen Inference Server

IBM veröffentlicht als Produktionsreferenz für Bob Core ein **9-Node-Cluster**. Diese Referenz ist nicht Single Node: Sie umfasst drei Control-Plane-, drei Infrastruktur- und drei Worker-Nodes. Sie berücksichtigt OpenShift-Overhead und Bob-Scheduling-Reserve. [IBM: Bob-Sizing und Cluster-Referenz](https://bob.ibm.com/docs/ide/enterprise/on-premises/system-requirements)

| IBM-Produktionsreferenz | Anzahl | CPU gesamt | RAM gesamt | Speicher |
|---|---:|---:|---:|---:|
| Control Plane | 3 | 12 vCPU | 48 GiB | je mindestens 100 GB |
| Infrastruktur | 3 | ca. 12 vCPU | ca. 48 GiB | in der Referenz enthalten |
| Worker | 3 | 24 vCPU | 48 GiB | 600 GiB insgesamt |
| **Gesamt** | **9 Nodes** | **ca. 48 vCPU** | **ca. 144 GiB** | **600 GiB Worker-Speicher** |

Die 600 GiB sind der empfohlene Speicherpool für die Worker. IBM nennt darin Bob-Persistent-Volumes, OpenShift-Dienste und Kapazität für Wachstum. Für PostgreSQL und OpenSearch empfiehlt IBM schnellen SSD-gestützten Blockspeicher. Backups brauchen außerdem ein separates Speicherziel.

Wenn du **bei einem einzelnen SNO-Node bleiben** willst, wäre als praktische Empfehlung — nicht als IBM-Vorgabe — **24 vCPU, 64 GB RAM und 500 GB SSD** anzusetzen. Das ist großzügiger als die rechnerische Mindestaddition, bleibt aber ein einzelner Ausfallpunkt und ersetzt nicht IBMs Cluster-Referenz.

## 3. Inference Server: minimale und empfohlene Planung

IBM empfiehlt als Core-Modelle unter anderem NVIDIA Nemotron 3.5 Super und Nemotron 3 Ultra; für Air-Gap empfiehlt IBM `gpt-oss-20b` als Guardrail. IBM veröffentlicht keine festen Mindestwerte für CPU und System-RAM des Inference-Servers. [IBM: unterstützte Modelle](https://bob.ibm.com/docs/ide/enterprise/on-premises/model-gateway/supported-models)

| Inference-Konfiguration | GPU / VRAM | CPU und System-RAM |
|---|---|---|
| **Minimal, Testbetrieb:** Nemotron 3.5 Super NVFP4 als Core | NVIDIA nennt **2 × 80 GB GPU** als Serving-Konfiguration | IBM/NVIDIA geben dafür keine feste Mindestangabe an. Als **Planungsschätzung**: ca. 32 CPU-Kerne und 256 GB RAM |
| `gpt-oss-20b` als Guardrail | OpenAI nennt 16 GB Speicher für lokale Ausführung | Kein zusätzlicher separater Serverwert veröffentlicht; Bedarf hängt vom Serving-Setup ab |
| **Empfohlen nach IBM-Validierung:** Nemotron-Modelle mit vLLM | IBM hat die empfohlenen Laufzeitparameter mit **NVIDIA H200** validiert. Für Nemotron 3 Ultra setzt IBMs Beispiel `tensor-parallel-size=8` — also 8 GPUs im Parallelbetrieb. | IBM nennt keine verbindlichen CPU-/RAM-Mindestwerte. Für diese größere Konfiguration müssen CPU, RAM und GPU-Server anhand des konkreten Modell-, Kontext- und Lastprofils dimensioniert werden. |

Die NVFP4-Konfiguration von Nemotron 3.5 Super benötigt laut NVIDIA 75 GB für die Modellgewichte und ist mit 2 × 80-GB-GPUs angegeben. Das ist die Modell-Serving-Konfiguration, nicht die komplette Bob-Installation. [NVIDIA: Nemotron 3.5 Super Serving](https://docs.nvidia.com/nemo-helix/latest/documentation/models-and-inference/deploy-models/) IBM beschreibt die H200-Werte ausdrücklich als validierte Laufzeitempfehlungen, nicht als feste Hardwareanforderung. [IBM: vLLM-Konfiguration](https://bob.ibm.com/docs/ide/enterprise/on-premises/model-gateway/vllm-runtime)

# IBM Bob On-Premise Air-Gapped Installation & Setup Guide

This guide provides a comprehensive, end-to-end walkthrough for deploying IBM Bob in a fully air-gapped OpenShift environment, configuring the Model Gateway, managing Keycloak identity, and setting up client workstations (Bob Shell CLI and Bob IDE).

---

## Table of Contents

- [Prerequisites & Architecture](#prerequisites--architecture)
- [Step 1: Download Images (Internet-Connected Host)](#step-1-download-images-internet-connected-host)
- [Step 2: Mirror Images to the On-Prem Private Registry (Bastion)](#step-2-mirror-images-to-the-on-prem-private-registry-bastion)
- [Step 3: Prepare Installation Configuration](#step-3-prepare-installation-configuration)
- [Step 4: Generate and Apply Cluster Resources](#step-4-generate-and-apply-cluster-resources)
- [Step 5: Deploy Bob Operator and Instance](#step-5-deploy-bob-operator-and-instance)
- [Step 6: Configure the Model Gateway](#step-6-configure-the-model-gateway)
- [Step 7: Identity & User Management (Keycloak)](#step-7-identity--user-management-keycloak)
- [Step 8: Configure Client Workstations (Bob Shell & Bob IDE)](#step-8-configure-client-workstations-bob-shell--bob-ide)
- [Troubleshooting Reference](#troubleshooting-reference)

---

## Prerequisites & Architecture

- **Internet-Connected Machine**: Requires `oc` CLI installed, access to `cp.icr.io` / `icr.io`, and an IBM Entitlement Key.
- **Air-Gapped Bastion**: Network access to the network internal image registry and the OpenShift (`oc`) CLI must be installed.
- **OpenShift Cluster Requirements**:
  - OpenShift 4.12+ (or supported version)
  - **Red Hat Cert-Manager Operator** installed and running, available as Operator to install from the OpenShift Dashboard
  - File Storage Class with `ReadWriteMany` (RWX) support (e.g. `ocs-storagecluster-cephfs`, `managed-nfs-storage`)
  - Block Storage Class with `ReadWriteOnce` (RWO) support (e.g. `ocs-storagecluster-ceph-rbd`)
- **Bob installer CLI**: Download from the [Official Repository](https://github.com/IBM/ibm-bob/releases) on GitHub.com

---

## Step 1: Download Images (Internet-Connected Host)

On a workstation with outbound internet connectivity:

### 1.1 Extract the downloaded Bob installer CLI

```bash
tar -zxvf ibm-bob-install-"<version-tag>".tar.gz
cd ibm-bob-install-"<version-tag>"
```

### 1.2 Download the Bob Core Container Images
```bash
mkdir -p ./images

export IBM_ENTITLEMENT_KEY="<YOUR_IBM_ENTITLEMENT_KEY>"

./bobctl download-images \
  --to-dir ./images \
  --src-creds "cp:${IBM_ENTITLEMENT_KEY}" \
  --arch amd64
```

---

## Step 2: Mirror Images to the On-Prem Private Registry (Bastion)

### 2.1 Copy installer and images to the bastion host

> [Note]
> If you can access the registry from your local machine directly (e.g. via VPN connection), you can skip this step

Use `scp` to copy everything to the target host

```bash
scp -r ./ibm-bob-install-"<version-tag>" "<user>"@"<bastion_host_ip>":"<target_folder>"
```

### 2.1 Fix Pre-baked Placeholder Destinations in Mapping Lists

During image download a `work` directory is created which holds mapping files.
This script sets a placeholder for the FQDN of the images, as it cannot know the target image registry. 
Replace the `placeholder` in the mapping files with your actual private registry hostname and its image repository before uploading.

```bash
# E.g: LOCAL_REGISTRY=registry.example.com/local-repo
export LOCAL_REGISTRY="<registry_url>/<local_repo>"
export REGISTRY_CREDS="<username>:<password>"

# Update all mapping files
sed -i "s|=placeholder/|=${LOCAL_REGISTRY}/|g" ./work/*-from-filesystem-mapping.lst
```

### 2.3 Upload Images to the Private Registry

```bash

./bobctl upload-images \
  --from-dir ./images \
  --dest-registry ${LOCAL_REGISTRY} \
  --dest-creds ${REGISTRY_CREDS}
```

---

## Step 3: Prepare Installation Configuration

Create `config.yaml` in your install directory from the `config-template.yaml` - Important: If you do not do this, then the verify command fails!:

```bash
cp config-template.yaml config.yaml
```

```yaml
# ── Global settings ───────────────────────────────────────────────────────────
global:
  operatorNamespace: ibm-bob-operators
  instanceNamespace: ibm-bob
  fileStorageClass: "ocs-storagecluster-cephfs"
  blockStorageClass: "ocs-storagecluster-ceph-rbd"
  imagePullPrefix: <registry_url>/<local_repo> <- This needs to point to your registry
  imagePullSecretName: registry-creds

# ── Bob instance settings ─────────────────────────────────────────────────────
bob:
  modelGateway:
    secrets:
      BOB_ONPREM_API_KEY: "<your-model-api-key>"
      CA_CERT: |
        -----BEGIN CERTIFICATE-----
        <YOUR_INTERNAL_OR_INGRESS_CA_CERTIFICATE>
        -----END CERTIFICATE-----
```

### 3.1 Validate Configuration and Images

```bash
./bobctl verify-images \
  --creds ${REGISTRY_CREDS} \
  --arch amd64
```

---

## Step 4: Generate and Apply Cluster Resources

Log in to the OpenShift cluster via `oc login`, then run:

```bash
# Generate the required CRDs and namespaces
./bobctl generate-cluster-resources

# Apply cluster-scoped resources
oc apply -f work/cluster-resources.yaml --force-conflicts --server-side
```

---

## Step 5: Deploy Bob Operator and Instance

Ensure the **Red Hat Cert-Manager Operator** is active on the cluster, then initiate the deployment:

```bash
./bobctl install \
  --registry-creds ${REGISTRY_CREDS} \
  --accept-license
```

### 5.1 Monitor the Deployment Progress

```bash
# Install started. Monitor progress with:
# Check operator status
oc get pods -n ibm-bob-operators
# Check Bob instance status and version
oc get bob -n ibm-bob
# View operator logs
oc logs -n ibm-bob-operators deployment/ibm-bob-operator -f

# Once the Bob instance is Ready, open the URL printed by:
oc get ingress bob-gateway -n ibm-bob -o jsonpath='{range .spec.rules[*]}{.host}{"\n"}{end}' | awk '!/^api\./{print "https://" $1; exit}'
```

---

## Step 6: Configure the Model Gateway

Create the model gateway routing configuration at `./config-model-gateway.yaml` from the template `config-model-gateway-template.yaml`:

```bash
cp config-model-gateway-template.yaml config-model-gateway.yaml
```

```yaml
general_settings:
  request_timeout: 600
  stream_timeout: 600

x-providers:
  laguna: &laguna
    openai_compatible:
      model: poolside/Laguna-S-2.1-FP8
      base_url: https://<primary-model-endpoint-url>
      insecure_skip_verify: true
      api_key: env.BOB_ONPREM_API_KEY
    model_info:
      exposed: true
      provider: poolside
      family: laguna
      version: "s2.1"
      max_input_tokens: 262144
      max_output_tokens: 32768
      supports_function_calling: true
      supports_tool_choice: true
      supports_reasoning: true
      supports_vision: false
      ca_cert_pem: env.CA_CERT
      mode: chat

models:
  # ── Active Core Model ────────────────────────────────────────────────────────
  - &chat_llm
    <<: *laguna
    model_name: premium-ide

  # ── Required System Aliases (Point to same single core model) ───────────────
  - <<: *chat_llm
    model_name: security

  - <<: *chat_llm
    model_name: background

  # ── Guardrail Model (Single Guardrail Model) ────────────────────────────────
  - model_name: openai/gpt-oss-20b
    openai_compatible:
      model: openai/gpt-oss-20b
      base_url: https://<guardrail-model-endpoint-url>
      insecure_skip_verify: true
      ca_cert_pem: env.CA_CERT
      api_key: env.BOB_ONPREM_API_KEY
    model_info:
      exposed: false
      provider: openai
      family: gpt-oss
      version: "20b"
      max_input_tokens: 32768
      max_output_tokens: 4096
      supports_function_calling: true
      supports_tool_choice: true
      mode: chat

# ── Router ────────────────────────────────────────────────────────────────────
routers:
  - name: router
    strategy: static
    static:
      default_model: premium-ide
```

### 6.1 Apply Model Gateway Configuration
```bash
./bobctl install \
  --model-config ./bob-install/config-model-gateway.yaml \
  --accept-license \
  --registry-creds ${REGISTRY_CREDS}
```

### 6.2 Test Model Discovery
```bash
oc exec -n ibm-bob deploy/bob-gateway -c runtime -- \
  sh -c "curl -sk https://bob-inference.ibm-bob.svc.cluster.local:7330/v1/model/info | jq ."
```

---

## Step 7: Identity & User Management (Keycloak)

> [!IMPORTANT]
> Bob routes login by email domain. The default built-in domain on-premise is `@bob.ibm.com`. Users with other domains (like `@ibm.com`) are redirected to public IBMid, which will return `"Client not found"`. Always create users with an `@bob.ibm.com` address unless LDAP federation is configured.

### 7.1 Retrieve Keycloak Temp-Admin Credentials

```bash
KC_URL="https://$(oc get route -n ibm-bob -l app=keycloak -o jsonpath='{.items[0].spec.host}')"
# Or explicit route:
KC_URL="https://bob-keycloak.ibm-bob.apps.<cluster_domain>"

KC_USER=$(oc get secret bob-keycloak-initial-admin -n ibm-bob -o jsonpath='{.data.username}' | base64 -d)
KC_PASS=$(oc get secret bob-keycloak-initial-admin -n ibm-bob -o jsonpath='{.data.password}' | base64 -d)
```
> [!CAUTION]
> Do not modify the `bob-keycloak-initial-admin` secret directly, as it is required by the operator for reconciliation.

### 7.2 Obtain Admin API Token

> [!TIP]
> If a response code of the `curl` commands is `401` be aware, that the access-token of the `master` realm in Keycloak is by default around 60 seconds.
> You may have to *refetch the token*. 

```bash
KC_TOKEN=$(curl -sk -X \
  POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -d "username=${KC_USER}" \
  -d "password=${KC_PASS}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r .access_token)
```

### 7.3 Create a User in the `bob` realm

Change the according to your user details.

```bash
NEW_EMAIL="<user_name>@bob.ibm.com"
NEW_USER="<user_name>"
NEW_USER_FIRST_NAME="<first_name>"
NEW_USER_LAST_NAME="<last_name>"
NEW_PASSWORD="<choose-a-strong-password>"

curl -sk -o /tmp/kc_user.json -w "HTTP %{http_code}\n" \
  -X POST "${KC_URL}/admin/realms/bob/users" \
  -H "Authorization: Bearer ${KC_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${NEW_USER}\",
    \"email\": \"${NEW_EMAIL}\",
    \"firstName\": \"${NEW_USER_FIRST_NAME}\",
    \"lastName\": \"${NEW_USER_LAST_NAME}\",
    \"enabled\": true,
    \"emailVerified\": true,
    \"credentials\": [{
      \"type\": \"password\",
      \"value\": \"${NEW_PASSWORD}\",
      \"temporary\": false
    }]
  }"
# Expected: HTTP 201
```

### 7.4 (Optional) Grant Admin Role

New users are automatically added to `bob-users`. To grant admin privileges:

```bash
USER_ID=$(curl -sk "${KC_URL}/admin/realms/bob/users?username=${NEW_USER}" \
  -H "Authorization: Bearer ${KC_TOKEN}" \
  | jq -r '.[0].id')

ADMIN_GROUP_ID=$(curl -sk "${KC_URL}/admin/realms/bob/groups" \
  -H "Authorization: Bearer ${KC_TOKEN}" \
  | jq -r '.[] | select(.name=="bob-admins") | .id')

curl -sk -X PUT \
  "${KC_URL}/admin/realms/bob/users/${USER_ID}/groups/${ADMIN_GROUP_ID}" \
  -H "Authorization: Bearer ${KC_TOKEN}" \
  -w "HTTP %{http_code}\n"

# Expected: HTTP 204
```

---

## Step 8: Configure Client Workstations (Bob Shell & Bob IDE)

### 8.1 Extract and Trust the Cluster CA Certificate

Extract the self-signed CA certificate managed by the OpenShift cert-manager into your `.bob` user settings folder under a newly created subfolder `on-prem-certs`.

```bash
mkdir -p ~/.bob/on-prem-certs
oc get secret bob-internal-ca-key-pair -n ibm-bob \
-o jsonpath='{.data.ca\.crt}' | base64 -d > ~/.bob/on-prem-certs/bob-ca.crt
```

Trust the CA certificate in the workstations operating system:

**macOS**:
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.bob/on-prem-certs/bob-ca.crt
```
**Linux (RHEL / CentOS / Fedora)**:
```bash
sudo cp ~/.bob/on-prem-certs/bob-ca.crt /etc/pki/ca-trust/source/anchors/bob-ca.crt
sudo update-ca-trust extract
```
**Linux (Ubuntu / Debian)**:
```bash
sudo cp ~/.bob/on-prem-certs/bob-ca.crt /usr/local/share/ca-certificates/bob-ca.crt
sudo update-ca-certificates
```
**Windows (PowerShell Administrator)**:
```powershell
certutil -addstore "Root" "$env:USERPROFILE\.bob\on-prem-certs\bob-ca.crt"
```

### 8.2 Configure Bob Shell (CLI)

1. Retrieve the general admin API key from the cluster (or generate a user key in Bob Admin UI):
   ```bash
   BOB_API_KEY=$(oc get secret bob-admin-secret -n ibm-bob -o jsonpath='{.data.BOB_API_KEY}' | base64 -d)
   ```
2. Add environment variables to `~/.zshrc` or `~/.bashrc` (ensure `export` is used):
   ```bash
   export BOB_GATEWAY_URL="https://api.bob.ibm-bob.apps.<cluster_domain>"
   export BOB_API_KEY="<your-api-key>"
   # Note: NODE_EXTRA_CA_CERTS must be an absolute path:
   export NODE_EXTRA_CA_CERTS="~/.bob/on-prem-certs/bob-ca.crt"

   # Optional endpoints
   export BOB_WEB_LOGIN_URL="https://bob-keycloak.ibm-bob.apps.<cluster_domain>"
   export BOB_UI_URL="https://bob.ibm-bob.apps.<cluster_domain>"
   ```
3. Source your profile and verify:
   ```bash
   source ~/.zshrc
   bob --accept-license -p "Write a Python hello world function"
   ```

### 8.3 Configure Bob IDE (VS Code Extension & Desktop App)

Open or create `~/.bob/settings/settings.json` on your workstation and configure:

```bash
bobide ~/.bob/settings/settings.json
```

```json
{
  "gatewayUrl": "https://api.bob.ibm-bob.apps.<cluster_domain>",
  "webLoginUrl": "https://bob-keycloak.ibm-bob.apps.<cluster_domain>",
  "http.experimental.systemCertificatesV2": true
}
```

Restart your IDE for the certificate trust and gateway URLs to take effect.

---

## Troubleshooting Reference

| Issue / Symptom | Root Cause | Resolution |
|---|---|---|
| `"Client not found"` on login | Email domain not `@bob.ibm.com` | Create users with `@bob.ibm.com` address or configure LDAP federation. |
| `Error: Bob API key is required` | Shell variables defined without `export` | Prefix all environment variables with `export` in shell profile. |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in CLI | Node.js does not trust the self-signed CA | Set `NODE_EXTRA_CA_CERTS` to the **absolute path** of `bob-ca.crt`. |
| `Sign in failed: fetch failed` in IDE | OS does not trust CA or missing experimental flag | Add `bob-ca.crt` to OS trust store/Keychain and add `"http.experimental.systemCertificatesV2": true` to `settings.json`. |
| `CrashLoopBackOff` on `bob-gateway` | NGINX blocks health checks from CGNAT IPs (`100.68.x.x`) | Apply `bob-gateway-probes-override` ConfigMap and patch deployment. |
| Image upload fails against `docker.io` | `placeholder` destination baked into mapping lists | Run `sed -i 's\|=placeholder/\|=${LOCAL_REGISTRY}/\|g'` across mapping files. |
| `HTTP 400` on Chat Completion | Missing required system model aliases | Map `premium-ide`, `security`, and `background` to the core LLM in `config-model-gateway.yaml`. |

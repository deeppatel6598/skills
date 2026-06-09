# Curation Notes

This collection keeps three upstream skill repos in separate folders. Below is
exactly what was kept, de-duplicated, and dropped — so any decision is
transparent and reversible.

## superpowers/ — kept in full (14)

All 14 skills copied as-is. No duplicates.

## claude-mem/ — kept in full (16), 2 byte-dupes dropped

All 16 skills from `plugin/skills/` were kept. The repo also had an
`openclaw/skills/` copy of `do` and `make-plan` — these are **byte-identical
duplicates** of the `plugin/skills/` versions and were not copied.

## ecc/ — de-duplicated + niche-trimmed (262 → 221)

### De-duplication (safe, structural)
- **`.agents/skills/` mirror (33 dirs)** — every skill there except one already
  existed in the canonical `skills/`. Only the unique **`everything-claude-code`**
  was pulled in; the rest were skipped as duplicates.
- **`continuous-learning`** — superseded by `continuous-learning-v2` (kept).

### Very-niche industry verticals dropped (40)
These apply only inside one narrow industry/domain. They were removed to keep the
library general-purpose. **To restore any of them**, copy the folder back from the
upstream ECC zip's `skills/` directory.

**Business / ERP ops (11)**
`carrier-relationship-management`, `customs-trade-compliance`,
`customer-billing-ops`, `finance-billing-ops`, `energy-procurement`,
`inventory-demand-planning`, `logistics-exception-management`,
`production-scheduling`, `quality-nonconformance`, `returns-reverse-logistics`,
`visa-doc-translate`

**Healthcare (5)**
`healthcare-cdss-patterns`, `healthcare-emr-patterns`, `healthcare-eval-harness`,
`healthcare-phi-compliance`, `hipaa-compliance`

**Crypto / DeFi utilities (6)**
`defi-amm-security`, `evm-token-decimals`, `nodejs-keccak256`,
`llm-trading-agent-security`, `prediction-market-oracle-research`,
`prediction-market-risk-review`

**Proprietary "ITO" trading product (4)**
`ito-basket-compare`, `ito-data-atlas-agent`, `ito-market-intelligence`,
`ito-trade-planner`

**Network device / Cisco (5)**
`cisco-ios-patterns`, `netmiko-ssh-automation`, `network-bgp-diagnostics`,
`network-config-validation`, `network-interface-health`

**Homelab (5)**
`homelab-network-readiness`, `homelab-network-setup`, `homelab-pihole-dns`,
`homelab-vlan-segmentation`, `homelab-wireguard-vpn`

**Scientific database lookups (3)**
`scientific-db-pubmed-database`, `scientific-db-uspto-database`,
`scientific-pkg-gget`

**Single-purpose tool (1)**
`blender-motion-state-inspection`

### Kept on purpose (despite looking specialized)
`agent-payment-x402` (agent commerce — relevant to agent builders),
the `scientific-thinking-*` skills (general research method, not a DB lookup),
and all language/framework families (`kotlin-*`, `swift-*`, `springboot-*`,
`django-*`, `laravel-*`, `quarkus-*`, etc.) — these are broadly useful.

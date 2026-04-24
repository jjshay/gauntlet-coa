# TrueCOA Technical Analysis

## Scope

This document analyzes the current repository as implemented in:

- backend API
- frontend verification app
- smart contract layer
- Google Apps Script certificate generation utilities
- exact-layout / export workflows currently represented in the repo changes

## Executive Summary

The system architecture is fundamentally sound:

- the backend is the integration hub
- Google Sheets is the operational datastore
- Polygon is the trust anchor
- the frontend is a presentation client over the backend contract

The main technical weaknesses are not architectural. They are consistency and integration weaknesses:

- schema naming drift
- multiple template implementations
- tab-name mismatch between backend and parts of Apps Script
- local proof/export workflows not yet formalized into the main runtime path

## Component Analysis

### 1. Backend

Primary file:

- [`backend/index.js`](/Users/johnshay/gauntlet-coa/backend/index.js)

Strengths:

- clear separation between Google Sheets reads and blockchain reads
- sensible normalization of verification payload for the frontend
- image proxy path reduces Google Drive embed issues
- graceful fallback behavior exists for some known COA cases

Current verified configuration:

- backend `.env` points `SPREADSHEET_ID` to `14GcZTEOMmfNdJvYmbS3CylAPEAz7z9NW_1rzvsfl6Ko`
- backend reads tab `COA`

Technical concerns:

- field normalization is permissive but inconsistent
- there are typos and alternate spellings in the data layer, for example `providence` vs `provenance`
- schema handling is implicit, not contract-driven
- fallbacks can hide data integrity problems

Recommended improvements:

- define a schema map once and validate incoming rows against it
- explicitly error on missing required columns
- move normalization logic into a dedicated adapter layer
- add tests for payload shape

### 2. Frontend

Primary file:

- [`frontend/src/App.jsx`](/Users/johnshay/gauntlet-coa/frontend/src/App.jsx)

Strengths:

- frontend certificate display is actually driven by backend data
- QR/manual entry flow is straightforward
- certificate rendering uses normalized `result.coa.*` fields from the API
- supporting links are derived consistently from backend response and blockchain status

Important result:

The live frontend certificate view is already tied to the backend Google Sheet indirectly through `/api/verify/:coaCode`.

That means the verification product path is sheet-backed.

Technical concerns:

- the certificate presentation logic is embedded directly in `App.jsx`
- print/export quality requirements have outgrown this inline rendering approach
- there is a gap between exact branded proofing work and the runtime frontend implementation

Recommended improvements:

- split certificate rendering into dedicated components
- create a canonical certificate presentation model
- reuse the same data contract for live view, PDF, and marketplace exports

### 3. Google Apps Script / template layer

Relevant files:

- [`google-apps-script/COAGenerator.gs`](/Users/johnshay/gauntlet-coa/google-apps-script/COAGenerator.gs)
- [`google-apps-script/COAGenerator_Combined.gs`](/Users/johnshay/gauntlet-coa/google-apps-script/COAGenerator_Combined.gs)
- [`google-apps-script/COA_EXACT_TEMPLATE.html`](/Users/johnshay/gauntlet-coa/google-apps-script/COA_EXACT_TEMPLATE.html)

Strengths:

- strong fit for operator-centric workflows
- natural place to generate cert assets and links from sheet rows
- direct sheet access reduces integration hops for batch generation

Technical concerns:

- at least part of this layer still uses `COA2` while backend uses `COA`
- the template layer and frontend runtime are not visibly unified on one presentation system
- embedded secrets and configuration style should be tightened

Most important technical issue here:

The system currently has a verified tab-name mismatch risk:

- backend: `COA`
- some Apps Script generator code: `COA2`

That is the single clearest integration inconsistency in the current codebase.

### 4. Smart contract layer

Strengths:

- minimal contract responsibilities
- backend only needs read functions for verification
- COA code -> token lookup pattern is appropriate for the product

Technical concerns:

- blockchain verification depends on RPC availability and external infra stability
- token metadata and runtime certificate display are conceptually related but operationally separate

This is acceptable. The contract should remain narrow in scope.

## Data Contract Analysis

The repository effectively uses Google Sheets as the source of truth, but the contract is spread across code comments, normalization logic, and generator assumptions.

Observed field families include:

- `coa_code`
- `signer` / `artist`
- `title`
- `date`
- `medium`
- `edition`
- `size` / `dimensions`
- `condition`
- `description`
- `providence` / `provenance`
- `assignor`
- `assignee`
- `image_url`
- `short_url`
- `blockchain_url`
- `nft_url`
- `cert_url`

Technical issue:

The model exists, but not as a formal schema.

Consequence:

- every layer partially reconstructs the model itself
- column changes can silently break rendering
- design and export work becomes fragile

Recommendation:

Create a canonical schema document and adapter implementation.

Example required core fields:

- `coa_code`
- `title`
- `artist`
- `image_url`
- `date`
- `medium`
- `size`
- `edition`

Example optional fields:

- `description`
- `provenance`
- `assignor`
- `assignee`
- `authenticator`
- `short_url`
- `cert_url`

## Layout / export analysis

The repo now contains exact-layout and marketplace export work that is valuable, but technically it still behaves like an adjunct workflow rather than a formal subsystem.

What exists:

- approved horizontal COA layout
- dedicated background assets
- eBay-ready exported COA image packaging

Technical implication:

This work should be promoted into a reproducible export pipeline instead of remaining a one-off local packaging path.

Recommended approach:

- make the approved layout a canonical template
- drive it from the same normalized verification payload
- support image export and PDF export from that one template system

## Operational Risks

### Highest risk: schema inconsistency

Why:

- multiple consumers of one sheet
- no hard validation contract
- different naming conventions already present in code

### Second highest risk: template fragmentation

Why:

- frontend runtime certificate
- Apps Script HTML templates
- exact proof templates
- marketplace export artifacts

These are all related but not yet unified.

### Third risk: environment / deployment drift

Why:

- frontend depends on `VITE_API_URL`
- backend depends on Google credentials, sheet ID, tab name, RPC, and contract address
- if one environment is updated and another is not, the product can appear broken even when code is correct

## Recommended Technical Roadmap

### 1. Define and enforce one COA schema

- create a schema doc
- validate required columns at backend startup
- normalize from a single adapter function

### 2. Unify sheet tab usage

- choose `COA` or `COA2`
- update backend and Apps Script to match
- remove dual-tab ambiguity

### 3. Canonicalize certificate rendering

- factor the runtime certificate into reusable components
- align it with the approved exact layout system
- separate live view concerns from export concerns while sharing one model

### 4. Formalize export pipeline

- generate PNG/JPG/PDF outputs from one approved certificate template
- avoid manual local branching for marketplace imagery

### 5. Add validation

- backend payload tests
- frontend render sanity tests
- smoke tests for sheet connectivity

## Conclusion

The codebase is viable and already useful. The major problem is not that it lacks a backend-sheet connection. That connection exists and is active in the runtime product.

The major problem is that the surrounding generation and presentation paths are not yet canonical.

If the repo is normalized around:

- one sheet contract
- one approved certificate system
- one export pipeline

then the platform becomes much easier to extend and much harder to break. 

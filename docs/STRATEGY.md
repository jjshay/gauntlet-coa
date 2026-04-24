# TrueCOA Strategy

## Objective

Turn TrueCOA into a reliable operating system for certificate-backed art sales:

- verification must be instant
- certificate presentation must look premium
- metadata management must remain simple for operations
- blockchain verification must add trust without adding friction
- marketplace exports must be reproducible

## Product Thesis

The strongest part of the current system is the split between operational data and trust infrastructure:

- Google Sheets is flexible enough for gallery operations
- the backend normalizes that operational data into a product API
- Polygon anchors authenticity and ownership claims
- the frontend turns that into a client-facing verification experience

That is the right architecture. The strategy should preserve it, then reduce the integration gaps.

## Strategic Priorities

### 1. Make the data contract canonical

Today, the biggest operational risk is not blockchain or hosting. It is drift between:

- backend field expectations
- Google Sheet column names
- Google Apps Script generator expectations
- frontend rendering assumptions

The strategy should be:

- define one canonical COA schema
- treat every other layer as a consumer of that schema
- stop allowing each layer to independently reinterpret the sheet

This reduces silent breakage and makes new certificate designs safer to ship.

### 2. Separate runtime verification from certificate production

There are two different product surfaces in this repo:

- runtime verification
- print / listing / export production

They should share data, but not be conflated.

Runtime verification needs:

- low-latency API responses
- resilient Google Sheets reads
- clean mobile rendering

Certificate production needs:

- deterministic layout rules
- exact branding control
- stable asset generation
- export-ready outputs for print and marketplaces

The strategy should formalize those as separate subsystems with a shared source of truth.

### 3. Promote the approved COA layout into the product

A lot of layout work has already been done and should not remain as ad hoc local proofing only.

The approved exact layout should be:

- treated as a canonical branded certificate presentation
- backed by the same API fields as the live frontend
- capable of rendering consistently for web, PDF, print, and marketplace exports

That reduces design drift and keeps one certificate language across channels.

### 4. Stabilize the Google Sheet integration

The backend is already tied to the intended spreadsheet ID, which is good.

The remaining strategic work is:

- unify the active tab name across backend and Apps Script
- document required columns as a contract
- add diagnostics when required fields are missing
- fail loudly when the sheet schema drifts

The right long-term move is not to replace Sheets immediately.
The right move is to make Sheets reliable enough to serve as an operations control plane.

### 5. Make export workflows first-class

The eBay-ready COA export exists now, but it is still effectively a packaging step around a local proof.

That should become a productized flow:

- choose COA code
- resolve sheet-backed metadata
- render approved branded certificate
- export listing-ready image assets

That closes the gap between certificate verification and marketplace operations.

## Business Value

If executed correctly, the system creates value in four ways:

### Trust

- public verification path
- visible chain-of-custody logic
- branded authenticity experience

### Operations

- simple metadata editing in Sheets
- low-friction asset generation
- easy listing support for marketplaces

### Brand

- premium presentation layer
- consistent certificate language
- stronger gallery credibility

### Scalability

- more artists
- more certificates
- more sales channels
- more automation around one shared COA model

## Risks

### Schema drift

This is the highest current risk.

Symptoms:

- one layer expects `COA`
- another expects `COA2`
- one layer reads `providence`
- another expects `provenance`

This leads to silent degradation rather than obvious failure.

### Layout fragmentation

There are several certificate paths:

- live frontend certificate view
- Apps Script templates
- exact print proofs
- marketplace exports

Without one canonical layout system, these will continue to drift.

### Environment coupling

The product depends on:

- service-account auth
- backend env configuration
- sheet permissions
- blockchain RPC reliability

That is manageable, but only if operational expectations are documented clearly.

## Recommended Strategic Roadmap

### Phase 1: Normalize

- define canonical COA schema
- unify sheet tab and column expectations
- document the contract in repo
- add validation around backend reads

### Phase 2: Canonicalize presentation

- adopt one approved exact certificate layout
- feed it from the same verification payload
- support screen, PDF, print, and marketplace outputs from one data model

### Phase 3: Operationalize exports

- add a formal export job for eBay / listing images
- support approved presets for portrait and landscape
- store output references back into the operational workflow

### Phase 4: Harden

- add payload tests
- add frontend rendering checks
- add health checks for sheet connectivity and schema integrity

## Bottom Line

TrueCOA already has the right backbone:

- sheet-backed operations
- API normalization
- blockchain verification
- branded certificate display

The next strategic win is not adding more features blindly.
It is making the current system canonical, deterministic, and reusable across verification, print, and marketplace workflows.

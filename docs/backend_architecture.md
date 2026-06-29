# Amdox ERP Backend Architecture

This document provides a high-level overview of the entire Amdox ERP backend architecture, detailing the domain modules, infrastructure, and event-driven communication flow.

```mermaid
graph TD
    Client[Client App / API Gateway]

    subgraph "Core Backend Services (NestJS)"
        
        subgraph "Finance Module"
            GL[General Ledger]
            AP[Accounts Payable & OCR]
            AR[Accounts Receivable]
            FX[FX & Multi-currency]
        end

        subgraph "HR Module"
            EMP[Employee Management]
            PAY[Payroll Engine & Payslips]
        end

        subgraph "SCM Module"
            INV[Inventory & Stock]
            PROC[Procurement & POs]
            SALES[Sales & Orders]
        end

        subgraph "PM Module"
            PROJ[Projects & Tasks]
            RES[Resource Allocation]
            BUDG[Budget Tracking]
        end

        subgraph "Infrastructure & Integration"
            EB(((Event Bus / EventEmitter)))
            BULL[(Redis / BullMQ Workers)]
        end
    end

    DB[(PostgreSQL Database via Prisma)]

    %% API Connections from Client
    Client --> GL & AP & AR
    Client --> EMP & PAY
    Client --> INV & PROC & SALES
    Client --> PROJ & RES & BUDG

    %% Database Connections
    GL & AP & AR & FX --> DB
    EMP & PAY --> DB
    INV & PROC & SALES --> DB
    PROJ & RES & BUDG --> DB

    %% Event Bus Integration (Decoupled Communication)
    AP -.->|emit: invoice.approved| EB
    PAY -.->|emit: payroll.completed| EB
    PROJ -.->|emit: project.created| EB
    RES -.->|emit: project.resource_needed| EB
    PROC -.->|emit: po.created| EB

    EB -.->|listen: auto-post journals| GL
    EB -.->|listen: update actuals| BUDG
    EB -.->|listen: adjust stock| INV
    
    %% Background Tasks
    AP -->|OCR processing| BULL
    PAY -->|PDF generation| BULL

    classDef module fill:#34495e,stroke:#2c3e50,stroke-width:2px,color:#fff;
    classDef infra fill:#8e44ad,stroke:#2c3e50,stroke-width:2px,color:#fff;
    classDef db fill:#27ae60,stroke:#2c3e50,stroke-width:2px,color:#fff;

    class GL,AP,AR,FX,EMP,PAY,INV,PROC,SALES,PROJ,RES,BUDG module;
    class EB,BULL infra;
    class DB db;
```

## How It Works:
1. **Domain Isolation**: Each major department (Finance, HR, SCM, PM) is strictly isolated into its own NestJS module.
2. **Event-Driven**: Modules communicate via the `Event Bus` rather than direct function calls, preventing "spaghetti code". For example, when Payroll is completed, it simply emits a `payroll.completed` event. The Finance GL listens to this event to automatically post journal entries.
3. **Background Jobs**: Heavy operations (like OCR scanning invoices or generating Payslip PDFs) are sent to Redis/BullMQ to keep the API blazing fast.

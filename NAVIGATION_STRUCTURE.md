# Navigation Structure & Information Architecture

## Primary Navigation

The main navigation structure for Kora is designed around business operations and user workflows:

```
├── Home / Dashboard
├── AI Assistant
├── Customers
├── Sales / Pipeline
├── Invoices
├── Expenses
├── Projects
├── Tasks
├── Team
├── Reports / Analytics
├── Documents
└── Settings
```

## Navigation Hierarchy

### 1. **Home / Dashboard** 
   - **Purpose**: Daily operations command center
   - **Features**:
     - Daily check-in
     - Quick metrics (revenue, customers, tasks, retention)
     - Business memory (summary of key metrics)
     - Activity stream
     - AI recommendations
   - **Audience**: All users
   - **Access**: Authenticated users

### 2. **AI Assistant**
   - **Purpose**: Intelligent guidance and recommendations
   - **Features**:
     - Recommendations dashboard
     - Insights panel
     - Context analysis
     - Chat interface
   - **Audience**: All users
   - **Permissions**: Requires all_data_access

### 3. **Customers**
   - **Purpose**: Customer relationship management
   - **Sub-sections**:
     - Customer list and profiles
     - Contact history
     - Communication preferences
     - Retention programs
     - Customer segments
   - **Audience**: Sales, Account managers, Admins
   - **Permissions**: view_team_data, all_data_access

### 4. **Sales / Pipeline**
   - **Purpose**: Sales opportunity tracking
   - **Sub-sections**:
     - Pipeline stages (Prospect → Closed)
     - Deal forecast
     - Sales velocity
     - Team performance
     - Win/loss analysis
   - **Audience**: Sales team, Managers, Admins
   - **Permissions**: view_team_data, all_data_access

### 5. **Invoices**
   - **Purpose**: Invoice management and tracking
   - **Sub-sections**:
     - Invoice list
     - Create invoice
     - Payment tracking
     - Overdue management
     - Invoice templates
     - Recurring invoices
   - **Audience**: Finance, Admins
   - **Permissions**: view_own_data, view_team_data, all_data_access

### 6. **Expenses**
   - **Purpose**: Expense tracking and management
   - **Sub-sections**:
     - Expense submissions
     - Approval workflows
     - Budget tracking
     - Spending reports
   - **Audience**: Finance, Managers, Admins
   - **Permissions**: view_team_data, all_data_access

### 7. **Projects**
   - **Purpose**: Project management
   - **Sub-sections**:
     - Project list
     - Project details
     - Timeline and milestones
     - Budget tracking
     - Team assignments
     - Progress reports
   - **Audience**: Project managers, Team leads, Admins
   - **Permissions**: view_team_data, all_data_access

### 8. **Tasks**
   - **Purpose**: Task and workflow management
   - **Sub-sections**:
     - My tasks
     - Team tasks
     - Automation workflows
     - Task templates
     - Recurring tasks
   - **Audience**: All users
   - **Permissions**: create_task, update_own_task, view_team_data

### 9. **Team**
   - **Purpose**: Team management
   - **Sub-sections**:
     - Team members
     - Roles and permissions
     - Team performance
     - Workload tracking
     - Onboarding
   - **Audience**: Managers, Admins
   - **Permissions**: create_user, manage_settings, all_data_access

### 10. **Reports / Analytics**
   - **Purpose**: Business intelligence and reporting
   - **Sub-sections**:
     - Revenue reports
     - Customer analytics
     - Sales forecasting
     - Custom reports
     - Export data
   - **Audience**: Managers, Finance, Admins
   - **Permissions**: view_reports, all_data_access

### 11. **Documents**
   - **Purpose**: Document management
   - **Sub-sections**:
     - Document library
     - Templates
     - Recent documents
     - Shared documents
   - **Audience**: All users (based on permissions)
   - **Permissions**: view_own_data, view_team_data

### 12. **Settings**
   - **Purpose**: System configuration
   - **Sub-sections**:
     - Profile settings
     - Organization settings
     - Billing & subscription
     - API keys (Admins/Owner)
     - Integrations
     - Security & audit logs
     - Notification preferences
     - Workspace management
   - **Audience**: Users (own settings), Admins (organization settings)
   - **Permissions**: Varies by subsection

---

## Role-Based Navigation Visibility

### Owner
- ✅ All sections visible
- ✅ Full access to Team, Settings, Billing
- ✅ View audit logs

### Admin
- ✅ Dashboard
- ✅ AI Assistant
- ✅ Customers
- ✅ Sales
- ✅ Invoices
- ✅ Expenses
- ✅ Projects
- ✅ Tasks
- ✅ Team
- ✅ Reports
- ✅ Documents
- ✅ Settings (organization, integrations, audit logs)

### Manager
- ✅ Dashboard
- ✅ AI Assistant
- ✅ Customers
- ✅ Sales
- ✅ Invoices
- ✅ Expenses
- ✅ Projects
- ✅ Tasks
- ✅ Reports
- ✅ Documents
- ⚠️ Team (view only, no management)
- ⚠️ Settings (own profile only)

### Employee
- ✅ Dashboard
- ✅ AI Assistant
- ✅ My Tasks
- ✅ Documents (shared only)
- ⚠️ Invoices (view only)
- ⚠️ Reports (team data only)
- ⚠️ Team (view only, no management)
- ⚠️ Settings (own profile only)

---

## Progressive Disclosure

### First-Time User Journey

1. **Landing Page**
   - Hero messaging
   - Feature overview
   - Pricing
   - CTA: Start free / Sign in

2. **Onboarding Flow**
   - Workspace setup
   - Organization details
   - Team member invitation
   - First business data entry
   - Initial AI context setup

3. **Dashboard (Day 1)**
   - Welcome message
   - Empty state guidance
   - Quick setup checklist
   - Documentation links

4. **Dashboard (After Data Entry)**
   - Metrics appear (revenue, customers, etc.)
   - AI insights become available
   - Recommendations displayed
   - Business memory populated

---

## Navigation Patterns

### Main Header
- Logo + Brand (clickable → Dashboard)
- Primary nav items (6-8 most important)
- Search bar (global search)
- User profile menu
- Notifications (if applicable)

### Sidebar (Optional)
- Collapsible main menu
- Current section indicator
- Quick actions
- Help / Support links

### Breadcrumbs
- Show navigation path (Home → Section → Subsection)
- Clickable for quick navigation

### Context Menu
- Right-click menus for common actions
- Quick add buttons (+Invoice, +Task, etc.)
- Batch operations

---

## Information Architecture Principles

1. **Progressive Disclosure**: Start with essential, reveal advanced
2. **Consistent Patterns**: Same nav patterns across sections
3. **Clear Hierarchy**: Important sections more prominent
4. **Search First**: Global search for power users
5. **Mobile-First**: Mobile nav prioritizes most used items
6. **Accessibility**: Keyboard navigation throughout
7. **Cognitive Load**: Max 3 levels deep in any menu

---

## Future Navigation Enhancements

- **Custom Dashboard Widgets**: Users can customize what appears
- **Favorites / Pinned Items**: Quick access to frequently used sections
- **AI-Suggested Navigation**: AI recommends next best action
- **Quick Commands**: Command palette (Cmd/Ctrl + K)
- **Mobile App**: Simplified nav for mobile devices
- **Dark Mode Toggle**: In Settings
- **Language Selection**: For international users

---

## Responsive Design

### Desktop (1200px+)
- Full horizontal nav
- Visible sidebar (collapsible)
- Full feature set

### Tablet (768px-1199px)
- Horizontal nav (condensed)
- Collapsible sidebar
- Touch-friendly buttons

### Mobile (< 768px)
- Hamburger menu
- Bottom tab bar for primary sections
- Simplified feature set
- Full-width sections

---

**Last Updated**: 2026-09-02
**Version**: 1.0
**Status**: Ready for Implementation

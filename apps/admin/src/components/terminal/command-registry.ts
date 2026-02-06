// Command Registry - Pay It Forward Command Center
// Real data search via Supabase + navigation for admin portal
import type { Command, CommandContext, CommandResult, TableData } from './types';

const commandMap = new Map<string, Command>();
const aliasMap = new Map<string, string>();

// ─── HELPER: Truncate long text ─────────────────────────────────────────────
function truncate(text: string | null | undefined, max = 30): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `$${Number(amount).toFixed(2)}`;
}

// ─── SEARCH COMMANDS (real Supabase queries) ────────────────────────────────

const searchCommand: Command = {
  name: 'search',
  aliases: ['s', 'find', 'query'],
  description: 'Global search across all records',
  usage: 'search [type] [query]  |  Types: member, agent, vendor, product, enrollment, invoice, commission, email  |  Or: search [query] (searches everything)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      return {
        type: 'info',
        message: `◈ SEARCH USAGE ◈\n\nsearch [query]              — Search all entities\nsearch member [name/email]  — Search members\nsearch agent [name]         — Search agents/advisors\nsearch vendor [name]        — Search vendors\nsearch product [name]       — Search products\nsearch enrollment [id/name] — Search enrollments\nsearch invoice [number]     — Search invoices\nsearch commission [agent]   — Search commissions\nsearch email [subject]      — Search sent emails`,
      };
    }

    const entityTypes = ['member', 'members', 'agent', 'agents', 'vendor', 'vendors', 'product', 'products', 'enrollment', 'enrollments', 'invoice', 'invoices', 'commission', 'commissions', 'email', 'emails', 'communication', 'communications'];
    const firstArg = args[0].toLowerCase();

    if (entityTypes.includes(firstArg)) {
      const query = args.slice(1).join(' ');
      const type = firstArg.replace(/s$/, ''); // normalize plural
      return await searchEntity(type, query, context);
    }

    // Global search across all entities
    const query = args.join(' ');
    return await globalSearch(query, context);
  },
};

async function globalSearch(query: string, context: CommandContext): Promise<CommandResult> {
  if (!context.supabase) {
    return { type: 'error', message: 'Database connection unavailable' };
  }

  const results: string[] = [];
  let totalFound = 0;

  // Search members
  const { data: members } = await context.supabase
    .from('profiles')
    .select('id, full_name, email, role, status')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(5) as any;
  if (members?.length) {
    totalFound += members.length;
    results.push(`\n◈ MEMBERS (${members.length} found)`);
    members.forEach((m: any) => {
      results.push(`  ${m.full_name || 'N/A'} — ${m.email || '—'} [${m.role || '—'}] → open member ${m.id}`);
    });
  }

  // Search agents/advisors
  const { data: agents } = await context.supabase
    .from('advisors')
    .select('id, full_name, email, license_number, status')
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(5) as any;
  if (agents?.length) {
    totalFound += agents.length;
    results.push(`\n◈ AGENTS (${agents.length} found)`);
    agents.forEach((a: any) => {
      results.push(`  ${a.full_name || 'N/A'} — ${a.email || '—'} [Lic: ${a.license_number || '—'}] → open agent ${a.id}`);
    });
  }

  // Search vendors
  const { data: vendors } = await context.supabase
    .from('vendors')
    .select('id, name, contact_email, status')
    .or(`name.ilike.%${query}%,contact_email.ilike.%${query}%`)
    .limit(5) as any;
  if (vendors?.length) {
    totalFound += vendors.length;
    results.push(`\n◈ VENDORS (${vendors.length} found)`);
    vendors.forEach((v: any) => {
      results.push(`  ${v.name || 'N/A'} — ${v.contact_email || '—'} [${v.status || '—'}] → open vendor ${v.id}`);
    });
  }

  // Search products
  const { data: products } = await context.supabase
    .from('plans')
    .select('id, plan_name, carrier, plan_type, status')
    .or(`plan_name.ilike.%${query}%,carrier.ilike.%${query}%`)
    .limit(5) as any;
  if (products?.length) {
    totalFound += products.length;
    results.push(`\n◈ PRODUCTS (${products.length} found)`);
    products.forEach((p: any) => {
      results.push(`  ${p.plan_name || 'N/A'} — ${p.carrier || '—'} [${p.plan_type || '—'}] → open product ${p.id}`);
    });
  }

  // Search enrollments
  const { data: enrollments } = await context.supabase
    .from('enrollments')
    .select('id, enrollment_code, status, effective_date, member_id')
    .or(`enrollment_code.ilike.%${query}%,status.ilike.%${query}%`)
    .limit(5) as any;
  if (enrollments?.length) {
    totalFound += enrollments.length;
    results.push(`\n◈ ENROLLMENTS (${enrollments.length} found)`);
    enrollments.forEach((e: any) => {
      results.push(`  ${e.enrollment_code || e.id.slice(0, 8)} — Status: ${e.status || '—'} [Eff: ${formatDate(e.effective_date)}] → open enrollment ${e.id}`);
    });
  }

  if (totalFound === 0) {
    return { type: 'warning', message: `No results found for "${query}"\n\nTry:\n  search member [name]\n  search agent [name]\n  search vendor [name]\n  search product [name]` };
  }

  return {
    type: 'info',
    message: `◈ GLOBAL SEARCH: "${query}" — ${totalFound} result(s) ◈${results.join('\n')}\n\nTip: Use "open [type] [id]" to navigate to a record`,
  };
}

async function searchEntity(type: string, query: string, context: CommandContext): Promise<CommandResult> {
  if (!context.supabase) {
    return { type: 'error', message: 'Database connection unavailable' };
  }

  switch (type) {
    case 'member':
      return await searchMembers(query, context);
    case 'agent':
      return await searchAgents(query, context);
    case 'vendor':
      return await searchVendors(query, context);
    case 'product':
      return await searchProducts(query, context);
    case 'enrollment':
      return await searchEnrollments(query, context);
    case 'invoice':
      return await searchInvoices(query, context);
    case 'commission':
      return await searchCommissions(query, context);
    case 'email':
    case 'communication':
      return await searchEmails(query, context);
    default:
      return { type: 'error', message: `Unknown entity type: ${type}` };
  }
}

async function searchMembers(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('profiles').select('id, full_name, email, phone, role, status, created_at').limit(15);
  if (query) {
    qb = qb.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No members found matching "${query}"` : 'No members found' };

  const tableData: TableData = {
    headers: ['Name', 'Email', 'Phone', 'Role', 'Status', 'ID'],
    rows: data.map((m: any) => [
      truncate(m.full_name, 25),
      truncate(m.email, 30),
      truncate(m.phone, 15),
      m.role || '—',
      m.status || '—',
      m.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ MEMBERS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open member [id]" to view details`,
    data: tableData,
  };
}

async function searchAgents(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('advisors').select('id, full_name, email, phone, license_number, status, commission_tier').limit(15);
  if (query) {
    qb = qb.or(`full_name.ilike.%${query}%,email.ilike.%${query}%,license_number.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No agents found matching "${query}"` : 'No agents found' };

  const tableData: TableData = {
    headers: ['Name', 'Email', 'License #', 'Tier', 'Status', 'ID'],
    rows: data.map((a: any) => [
      truncate(a.full_name, 25),
      truncate(a.email, 30),
      a.license_number || '—',
      a.commission_tier || '—',
      a.status || '—',
      a.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ AGENTS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open agent [id]" to view details`,
    data: tableData,
  };
}

async function searchVendors(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('vendors').select('id, name, contact_email, contact_phone, status, vendor_type').limit(15);
  if (query) {
    qb = qb.or(`name.ilike.%${query}%,contact_email.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No vendors found matching "${query}"` : 'No vendors found' };

  const tableData: TableData = {
    headers: ['Name', 'Email', 'Phone', 'Type', 'Status', 'ID'],
    rows: data.map((v: any) => [
      truncate(v.name, 25),
      truncate(v.contact_email, 30),
      truncate(v.contact_phone, 15),
      v.vendor_type || '—',
      v.status || '—',
      v.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ VENDORS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open vendor [id]" to view details`,
    data: tableData,
  };
}

async function searchProducts(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('plans').select('id, plan_name, carrier, plan_type, status, monthly_premium').limit(15);
  if (query) {
    qb = qb.or(`plan_name.ilike.%${query}%,carrier.ilike.%${query}%,plan_type.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No products found matching "${query}"` : 'No products found' };

  const tableData: TableData = {
    headers: ['Plan Name', 'Carrier', 'Type', 'Premium', 'Status', 'ID'],
    rows: data.map((p: any) => [
      truncate(p.plan_name, 30),
      truncate(p.carrier, 20),
      p.plan_type || '—',
      formatCurrency(p.monthly_premium),
      p.status || '—',
      p.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ PRODUCTS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open product [id]" to view details`,
    data: tableData,
  };
}

async function searchEnrollments(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('enrollments').select('id, enrollment_code, status, effective_date, termination_date, member_id, plan_id, created_at').order('created_at', { ascending: false }).limit(15);
  if (query) {
    qb = qb.or(`enrollment_code.ilike.%${query}%,status.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No enrollments found matching "${query}"` : 'No enrollments found' };

  const tableData: TableData = {
    headers: ['Code', 'Status', 'Effective', 'End Date', 'Created', 'ID'],
    rows: data.map((e: any) => [
      e.enrollment_code || '—',
      e.status || '—',
      formatDate(e.effective_date),
      formatDate(e.termination_date),
      formatDate(e.created_at),
      e.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ ENROLLMENTS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open enrollment [id]" to view details`,
    data: tableData,
  };
}

async function searchInvoices(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('invoices').select('id, invoice_number, status, amount_due, amount_paid, due_date, created_at').order('created_at', { ascending: false }).limit(15);
  if (query) {
    qb = qb.or(`invoice_number.ilike.%${query}%,status.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No invoices found matching "${query}"` : 'No invoices found' };

  const tableData: TableData = {
    headers: ['Invoice #', 'Status', 'Amount Due', 'Paid', 'Due Date', 'ID'],
    rows: data.map((i: any) => [
      i.invoice_number || '—',
      i.status || '—',
      formatCurrency(i.amount_due),
      formatCurrency(i.amount_paid),
      formatDate(i.due_date),
      i.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ INVOICES: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈\nUse "open invoice [id]" to view details`,
    data: tableData,
  };
}

async function searchCommissions(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('commission_transactions').select('id, advisor_id, enrollment_id, commission_amount, status, payment_type, created_at').order('created_at', { ascending: false }).limit(15);
  if (query) {
    qb = qb.or(`status.ilike.%${query}%,payment_type.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No commissions found matching "${query}"` : 'No commission records found' };

  const tableData: TableData = {
    headers: ['Amount', 'Status', 'Type', 'Advisor ID', 'Created', 'ID'],
    rows: data.map((c: any) => [
      formatCurrency(c.commission_amount),
      c.status || '—',
      c.payment_type || '—',
      c.advisor_id?.slice(0, 8) || '—',
      formatDate(c.created_at),
      c.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ COMMISSIONS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈`,
    data: tableData,
  };
}

async function searchEmails(query: string, context: CommandContext): Promise<CommandResult> {
  let qb = context.supabase.from('sent_emails').select('id, to_email, subject, status, template_name, sent_at, created_at').order('created_at', { ascending: false }).limit(15);
  if (query) {
    qb = qb.or(`to_email.ilike.%${query}%,subject.ilike.%${query}%`);
  }
  const { data, error } = await qb as any;
  if (error) return { type: 'error', message: `Search failed: ${error.message}` };
  if (!data?.length) return { type: 'warning', message: query ? `No emails found matching "${query}"` : 'No sent emails found' };

  const tableData: TableData = {
    headers: ['To', 'Subject', 'Template', 'Status', 'Sent', 'ID'],
    rows: data.map((e: any) => [
      truncate(e.to_email, 25),
      truncate(e.subject, 30),
      truncate(e.template_name, 15),
      e.status || '—',
      formatDate(e.sent_at || e.created_at),
      e.id?.slice(0, 8) || '—',
    ]),
  };

  return {
    type: 'table',
    message: `◈ EMAILS: ${data.length} result(s) ${query ? `for "${query}"` : '(recent)'} ◈`,
    data: tableData,
  };
}

// ─── ENTITY SHORTCUT COMMANDS ───────────────────────────────────────────────

const memberCommand: Command = {
  name: 'member',
  aliases: ['members', 'mem'],
  description: 'Search or list members',
  usage: 'member [name/email]  |  member (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/members');
      return { type: 'success', message: '◈ NAVIGATING TO MEMBERS ◈' };
    }
    return await searchMembers(args.join(' '), context);
  },
};

const agentCommand: Command = {
  name: 'agent',
  aliases: ['agents', 'advisor', 'advisors'],
  description: 'Search or list agents/advisors',
  usage: 'agent [name/email]  |  agent (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/agents');
      return { type: 'success', message: '◈ NAVIGATING TO AGENTS ◈' };
    }
    return await searchAgents(args.join(' '), context);
  },
};

const vendorCommand: Command = {
  name: 'vendor',
  aliases: ['vendors', 'ven'],
  description: 'Search or list vendors',
  usage: 'vendor [name]  |  vendor (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/vendors');
      return { type: 'success', message: '◈ NAVIGATING TO VENDORS ◈' };
    }
    return await searchVendors(args.join(' '), context);
  },
};

const productCommand: Command = {
  name: 'product',
  aliases: ['products', 'plan', 'plans'],
  description: 'Search or list products/plans',
  usage: 'product [name/carrier]  |  product (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/products');
      return { type: 'success', message: '◈ NAVIGATING TO PRODUCTS ◈' };
    }
    return await searchProducts(args.join(' '), context);
  },
};

const enrollmentCommand: Command = {
  name: 'enrollment',
  aliases: ['enrollments', 'enroll', 'enr'],
  description: 'Search or list enrollments',
  usage: 'enrollment [code/status]  |  enrollment (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/enrollments');
      return { type: 'success', message: '◈ NAVIGATING TO ENROLLMENTS ◈' };
    }
    return await searchEnrollments(args.join(' '), context);
  },
};

const invoiceCommand: Command = {
  name: 'invoice',
  aliases: ['invoices', 'inv'],
  description: 'Search or list invoices',
  usage: 'invoice [number/status]  |  invoice (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/invoices');
      return { type: 'success', message: '◈ NAVIGATING TO INVOICES ◈' };
    }
    return await searchInvoices(args.join(' '), context);
  },
};

const commissionCommand: Command = {
  name: 'commission',
  aliases: ['commissions', 'comm'],
  description: 'Search or list commissions',
  usage: 'commission [status/type]  |  commission (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/commissions');
      return { type: 'success', message: '◈ NAVIGATING TO COMMISSIONS ◈' };
    }
    return await searchCommissions(args.join(' '), context);
  },
};

const emailCommand: Command = {
  name: 'email',
  aliases: ['emails', 'mail'],
  description: 'Search sent emails/communications',
  usage: 'email [recipient/subject]  |  email (lists recent)',
  category: 'actions',
  handler: async (args, context) => {
    if (!args.length) {
      context.navigate('/communications');
      return { type: 'success', message: '◈ NAVIGATING TO COMMUNICATIONS ◈' };
    }
    return await searchEmails(args.join(' '), context);
  },
};

// ─── OPEN COMMAND (navigate to specific record) ─────────────────────────────

const openCommand: Command = {
  name: 'open',
  aliases: ['o', 'view', 'goto-record'],
  description: 'Open a record by type and ID',
  usage: 'open [type] [id]  |  Types: member, agent, vendor, product, enrollment, invoice',
  category: 'actions',
  handler: (args, context) => {
    const [type, ...idParts] = args;
    const id = idParts.join(' ');
    if (!type || !id) {
      return {
        type: 'info',
        message: `◈ OPEN RECORD ◈\n\nUsage: open [type] [id]\n\nTypes:\n  member [id]      — Open member profile\n  agent [id]       — Open agent details\n  vendor [id]      — Open vendor page\n  product [id]     — Open product/plan\n  enrollment [id]  — Open enrollment\n  invoice [id]     — Open invoice`,
      };
    }

    const routes: Record<string, string> = {
      member: `/members/${id}`,
      agent: `/agents/${id}`,
      vendor: `/vendors/${id}`,
      product: `/products/${id}`,
      plan: `/products/${id}`,
      enrollment: `/enrollments/${id}`,
      invoice: `/invoices/${id}`,
      commission: `/commissions`,
      billing: `/billing`,
    };

    const normalizedType = type.toLowerCase().replace(/s$/, '');
    const route = routes[normalizedType];
    if (!route) {
      return { type: 'error', message: `Unknown type: ${type}. Try: member, agent, vendor, product, enrollment, invoice` };
    }

    context.navigate(route);
    return { type: 'success', message: `◈ OPENING ${normalizedType.toUpperCase()} ${id.slice(0, 8)}… ◈` };
  },
};

// ─── NEW COMMAND (create record) ────────────────────────────────────────────

const newCommand: Command = {
  name: 'new',
  aliases: ['n', 'create', 'add'],
  description: 'Create a new record',
  usage: 'new [type]  |  Types: member, enrollment, agent, product, vendor, invoice, email',
  category: 'actions',
  handler: (args, context) => {
    const type = args[0]?.toLowerCase();
    const routes: Record<string, string> = {
      member: '/members?action=new',
      enrollment: '/enrollments?action=new',
      agent: '/agents?action=new',
      product: '/products?action=new',
      vendor: '/vendors?action=new',
      invoice: '/invoices?action=new',
      email: '/communications?tab=compose',
      link: '/enrollment-links',
    };

    if (!type) {
      return {
        type: 'info',
        message: `◈ CREATE NEW RECORD ◈\n\nUsage: new [type]\n\nTypes:\n  member      — New member\n  enrollment  — New enrollment\n  agent       — New agent/advisor\n  product     — New product/plan\n  vendor      — New vendor\n  invoice     — New invoice\n  email       — Compose email\n  link        — Enrollment link`,
      };
    }

    const route = routes[type];
    if (!route) {
      return { type: 'error', message: `Unknown type: ${type}. Try: member, enrollment, agent, product, vendor, invoice, email, link` };
    }

    context.navigate(route);
    return { type: 'success', message: `◈ CREATING NEW ${type.toUpperCase()} ◈` };
  },
};

// ─── NAVIGATION COMMANDS ────────────────────────────────────────────────────

const gotoCommand: Command = {
  name: 'goto',
  aliases: ['go', 'nav', 'navigate'],
  description: 'Navigate to any page',
  usage: 'goto [path]  |  e.g. goto dashboard, goto members, goto settings',
  category: 'navigation',
  handler: (_args, context) => {
    const path = _args[0];
    if (!path) {
      return { type: 'error', message: 'Usage: goto [path] — e.g. goto dashboard, goto members' };
    }
    // Map shortcuts
    const shortcuts: Record<string, string> = {
      home: '/dashboard',
      dashboard: '/dashboard',
      dash: '/dashboard',
      members: '/members',
      agents: '/agents',
      vendors: '/vendors',
      products: '/products',
      enrollments: '/enrollments',
      billing: '/billing',
      invoices: '/invoices',
      commissions: '/commissions',
      communications: '/communications',
      comms: '/communications',
      settings: '/settings',
      reports: '/reports',
      analytics: '/analytics',
      ops: '/ops',
      payables: '/payables',
      links: '/enrollment-links',
    };
    const fullPath = shortcuts[path.toLowerCase()] || (path.startsWith('/') ? path : `/${path}`);
    context.navigate(fullPath);
    return { type: 'success', message: `◈ NAVIGATING TO ${fullPath.toUpperCase()} ◈` };
  },
};

const dashboardCommand: Command = {
  name: 'dashboard',
  aliases: ['home', 'dash', 'bridge', 'b'],
  description: 'Go to dashboard',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/dashboard');
    return { type: 'success', message: '◈ NAVIGATING TO DASHBOARD ◈' };
  },
};

const billingCommand: Command = {
  name: 'billing',
  aliases: ['pay', 'payments'],
  description: 'Go to billing & payments',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/billing');
    return { type: 'success', message: '◈ NAVIGATING TO BILLING ◈' };
  },
};

const reportsCommand: Command = {
  name: 'reports',
  aliases: ['report', 'analytics', 'stats'],
  description: 'Go to reports & analytics',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/reports');
    return { type: 'success', message: '◈ NAVIGATING TO REPORTS ◈' };
  },
};

const settingsCommand: Command = {
  name: 'settings',
  aliases: ['config', 'prefs', 'preferences'],
  description: 'Go to settings',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/settings');
    return { type: 'success', message: '◈ NAVIGATING TO SETTINGS ◈' };
  },
};

const opsCommand: Command = {
  name: 'ops',
  aliases: ['operations', 'jobs'],
  description: 'Go to operations/jobs',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/ops');
    return { type: 'success', message: '◈ NAVIGATING TO OPERATIONS ◈' };
  },
};

const linksCommand: Command = {
  name: 'links',
  aliases: ['enrollment-links', 'qr'],
  description: 'Go to enrollment links',
  category: 'navigation',
  handler: (_args, context) => {
    context.navigate('/enrollment-links');
    return { type: 'success', message: '◈ NAVIGATING TO ENROLLMENT LINKS ◈' };
  },
};

// ─── DATA / STATUS COMMANDS ─────────────────────────────────────────────────

const countCommand: Command = {
  name: 'count',
  aliases: ['counts', 'totals', 'summary'],
  description: 'Show record counts across all entities',
  category: 'data',
  handler: async (_args, context) => {
    if (!context.supabase) {
      return { type: 'error', message: 'Database connection unavailable' };
    }

    const counts: string[] = [];
    const tables = [
      { name: 'Members', table: 'profiles' },
      { name: 'Agents', table: 'advisors' },
      { name: 'Vendors', table: 'vendors' },
      { name: 'Products', table: 'plans' },
      { name: 'Enrollments', table: 'enrollments' },
      { name: 'Invoices', table: 'invoices' },
      { name: 'Commissions', table: 'commission_transactions' },
      { name: 'Emails Sent', table: 'sent_emails' },
    ];

    for (const { name, table } of tables) {
      try {
        const { count, error } = await context.supabase
          .from(table)
          .select('*', { count: 'exact', head: true }) as any;
        counts.push(`  ${name.padEnd(20)} ${error ? 'Error' : (count ?? 0).toString()}`);
      } catch {
        counts.push(`  ${name.padEnd(20)} —`);
      }
    }

    return {
      type: 'info',
      message: `◈ RECORD COUNTS ◈\n${'─'.repeat(35)}\n${counts.join('\n')}\n${'─'.repeat(35)}`,
    };
  },
};

const statusCommand: Command = {
  name: 'status',
  aliases: ['sys', 'system'],
  description: 'System status and database connectivity check',
  category: 'data',
  handler: async (_args, context) => {
    if (!context.supabase) {
      return { type: 'error', message: 'Database connection unavailable' };
    }

    const checks: string[] = [];
    const startTime = Date.now();

    // Check database connectivity
    try {
      const { error } = await context.supabase.from('profiles').select('id', { count: 'exact', head: true }) as any;
      const latency = Date.now() - startTime;
      checks.push(`  Database       ${error ? '✗ DOWN' : '✓ Online'}  (${latency}ms)`);
    } catch {
      checks.push(`  Database       ✗ Connection Failed`);
    }

    // Check auth
    try {
      const { data: { user } } = await context.supabase.auth.getUser();
      checks.push(`  Auth           ${user ? '✓ Authenticated' : '✗ Not authenticated'}`);
      if (user) {
        checks.push(`  User           ${user.email}`);
      }
    } catch {
      checks.push(`  Auth           ✗ Failed`);
    }

    checks.push(`  Role           ${context.userRole || '—'}`);
    checks.push(`  Session        ✓ Active`);

    return {
      type: 'info',
      message: `◈ SYSTEM STATUS ◈\n${'─'.repeat(45)}\n${checks.join('\n')}\n${'─'.repeat(45)}\n  Timestamp: ${new Date().toLocaleString()}`,
    };
  },
};

const recentCommand: Command = {
  name: 'recent',
  aliases: ['latest', 'activity', 'log'],
  description: 'Show recent activity log entries',
  usage: 'recent [count]  |  Default: 10',
  category: 'data',
  handler: async (args, context) => {
    if (!context.supabase) {
      return { type: 'error', message: 'Database connection unavailable' };
    }

    const limit = Math.min(parseInt(args[0]) || 10, 25);
    const { data, error } = await context.supabase
      .from('admin_activity_log')
      .select('id, action, entity_type, entity_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit) as any;

    if (error) return { type: 'error', message: `Failed to load activity: ${error.message}` };
    if (!data?.length) return { type: 'warning', message: 'No recent activity found' };

    const tableData: TableData = {
      headers: ['Action', 'Entity', 'Entity ID', 'Time'],
      rows: data.map((a: any) => [
        a.action || '—',
        a.entity_type || '—',
        a.entity_id?.slice(0, 8) || '—',
        formatDate(a.created_at),
      ]),
    };

    return {
      type: 'table',
      message: `◈ RECENT ACTIVITY (${data.length} entries) ◈`,
      data: tableData,
    };
  },
};

// ─── SYSTEM COMMANDS ────────────────────────────────────────────────────────

const helpCommand: Command = {
  name: 'help',
  aliases: ['h', '?', 'commands'],
  description: 'Show all available commands',
  category: 'system',
  handler: (_args, context) => {
    context.setPanel('help');
    return {
      type: 'panel',
      panel: 'help',
      message: '◈ COMMAND REFERENCE ◈',
    };
  },
};

const clearCommand: Command = {
  name: 'clear',
  aliases: ['cls', 'reset'],
  description: 'Clear terminal output',
  category: 'system',
  handler: (_args, context) => {
    context.clearOutput();
    return { type: 'info', message: '◈ TERMINAL CLEARED ◈' };
  },
};

const themeCommand: Command = {
  name: 'theme',
  aliases: ['mode', 'dark', 'light'],
  description: 'Toggle dark/light mode',
  usage: 'theme [dark|light]',
  category: 'system',
  handler: (args, context) => {
    const mode = args[0]?.toLowerCase();
    if (mode && mode !== 'dark' && mode !== 'light') {
      return { type: 'error', message: 'Usage: theme [dark|light]' };
    }
    context.toggleTheme();
    return { type: 'success', message: `◈ THEME TOGGLED ◈` };
  },
};

const logoutCommand: Command = {
  name: 'logout',
  aliases: ['signout', 'exit'],
  description: 'Sign out of the system',
  category: 'system',
  handler: (_args, context) => {
    context.navigate('/login');
    return { type: 'warning', message: '◈ INITIATING LOGOUT SEQUENCE ◈' };
  },
};

const echoCommand: Command = {
  name: 'echo',
  aliases: ['print', 'say'],
  description: 'Echo text back',
  category: 'system',
  handler: (args) => {
    return { type: 'info', message: args.join(' ') || '...' };
  },
};

const dateCommand: Command = {
  name: 'stardate',
  aliases: ['date', 'time', 'now'],
  description: 'Show current date and time',
  category: 'system',
  handler: () => {
    const now = new Date();
    const stardate = (now.getFullYear() - 2000) * 1000 +
      Math.floor((now.getMonth() * 30 + now.getDate()) / 365 * 1000);
    return {
      type: 'info',
      message: `◈ STARDATE ${stardate.toFixed(1)} ◈\n${now.toLocaleString()}`,
    };
  },
};

const whoamiCommand: Command = {
  name: 'whoami',
  aliases: ['me', 'profile', 'user'],
  description: 'Show current user info',
  category: 'system',
  handler: async (_args, context) => {
    if (!context.supabase) {
      return { type: 'error', message: 'Database connection unavailable' };
    }

    try {
      const { data: { user } } = await context.supabase.auth.getUser();
      return {
        type: 'info',
        message: `◈ CURRENT USER ◈\n${'─'.repeat(35)}\n  Email:   ${user?.email || '—'}\n  User ID: ${context.userId || '—'}\n  Role:    ${context.userRole || '—'}\n  Org ID:  ${context.tenantId || '—'}\n${'─'.repeat(35)}`,
      };
    } catch {
      return { type: 'error', message: 'Failed to fetch user info' };
    }
  },
};

// ─── REGISTER ALL COMMANDS ──────────────────────────────────────────────────

const builtInCommands: Command[] = [
  // Search (primary)
  searchCommand,
  // Entity shortcuts (search + navigate)
  memberCommand,
  agentCommand,
  vendorCommand,
  productCommand,
  enrollmentCommand,
  invoiceCommand,
  commissionCommand,
  emailCommand,
  // Actions
  openCommand,
  newCommand,
  // Navigation
  gotoCommand,
  dashboardCommand,
  billingCommand,
  reportsCommand,
  settingsCommand,
  opsCommand,
  linksCommand,
  // Data
  countCommand,
  statusCommand,
  recentCommand,
  // System
  helpCommand,
  clearCommand,
  themeCommand,
  logoutCommand,
  echoCommand,
  dateCommand,
  whoamiCommand,
];

// Initialize command registry
builtInCommands.forEach(cmd => {
  commandMap.set(cmd.name, cmd);
  cmd.aliases?.forEach(alias => aliasMap.set(alias, cmd.name));
});

// Public API
export function getCommand(name: string): Command | undefined {
  const normalizedName = name.toLowerCase();
  const actualName = aliasMap.get(normalizedName) || normalizedName;
  return commandMap.get(actualName);
}

export function getAllCommands(): Command[] {
  return Array.from(commandMap.values());
}

export function getCommandNames(): string[] {
  const names = Array.from(commandMap.keys());
  const aliases = Array.from(aliasMap.keys());
  return [...names, ...aliases].sort();
}

export function registerCommands(commands: Command[]): void {
  commands.forEach(cmd => {
    commandMap.set(cmd.name, cmd);
    cmd.aliases?.forEach(alias => aliasMap.set(alias, cmd.name));
  });
}

export function unregisterCommand(name: string): boolean {
  const cmd = commandMap.get(name);
  if (cmd) {
    commandMap.delete(name);
    cmd.aliases?.forEach(alias => aliasMap.delete(alias));
    return true;
  }
  return false;
}

export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'info', message: '' };
  }

  const [commandName, ...args] = trimmed.split(/\s+/);
  const command = getCommand(commandName);

  if (!command) {
    // Fuzzy suggestion
    const allNames = getCommandNames();
    const suggestions = allNames
      .filter(n => n.startsWith(commandName.toLowerCase().slice(0, 2)))
      .slice(0, 5);
    const hint = suggestions.length
      ? `\nDid you mean: ${suggestions.join(', ')}?`
      : '';
    return {
      type: 'error',
      message: `Unknown command: ${commandName}\nType 'help' for available commands.${hint}`,
    };
  }

  try {
    const result = await command.handler(args, context);
    return { ...result, timestamp: Date.now() };
  } catch (error) {
    return {
      type: 'error',
      message: `Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: Date.now(),
    };
  }
}

export function getSuggestions(input: string): string[] {
  if (!input) return [];
  const lower = input.toLowerCase();

  // If input contains a space, suggest entity types for search
  const parts = lower.split(/\s+/);
  if (parts.length === 2 && ['search', 's', 'find', 'query'].includes(parts[0])) {
    const entityTypes = ['member', 'agent', 'vendor', 'product', 'enrollment', 'invoice', 'commission', 'email'];
    const typePrefix = parts[1];
    return entityTypes
      .filter(t => t.startsWith(typePrefix))
      .map(t => `${parts[0]} ${t}`)
      .slice(0, 8);
  }

  if (parts.length === 2 && ['new', 'n', 'create', 'add'].includes(parts[0])) {
    const newTypes = ['member', 'enrollment', 'agent', 'product', 'vendor', 'invoice', 'email', 'link'];
    const typePrefix = parts[1];
    return newTypes
      .filter(t => t.startsWith(typePrefix))
      .map(t => `${parts[0]} ${t}`)
      .slice(0, 8);
  }

  if (parts.length === 2 && ['open', 'o', 'view'].includes(parts[0])) {
    const openTypes = ['member', 'agent', 'vendor', 'product', 'enrollment', 'invoice'];
    const typePrefix = parts[1];
    return openTypes
      .filter(t => t.startsWith(typePrefix))
      .map(t => `${parts[0]} ${t}`)
      .slice(0, 8);
  }

  if (parts.length === 2 && ['goto', 'go', 'nav', 'navigate'].includes(parts[0])) {
    const destinations = ['dashboard', 'members', 'agents', 'vendors', 'products', 'enrollments', 'billing', 'invoices', 'commissions', 'communications', 'settings', 'reports', 'analytics', 'ops', 'payables', 'links'];
    const destPrefix = parts[1];
    return destinations
      .filter(d => d.startsWith(destPrefix))
      .map(d => `${parts[0]} ${d}`)
      .slice(0, 8);
  }

  const allNames = getCommandNames();
  return allNames
    .filter(name => name.startsWith(lower))
    .slice(0, 8);
}

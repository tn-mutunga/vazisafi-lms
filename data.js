// Mock data for Safi Laundry Management System
// All names, phone numbers, and details are fictional.

window.SAFI_DATA = (() => {
  const services = [
    { id: 'wash-fold', name: 'Wash & Fold',   unit: 'kg',    icon: 'wash',    category: 'laundry',     tiers: { student: 80,  normal: 120, corporate: 100 } },
    { id: 'dry-clean', name: 'Dry Cleaning',  unit: 'piece', icon: 'dry',     category: 'drycleaning', tiers: { student: 200, normal: 280, corporate: 240 }, subtypes: [{name:'Shirt', price:200},{name:'Trouser', price:200},{name:'Suit (2pc)', price:500},{name:'Suit (3pc)', price:700},{name:'Dress', price:350},{name:'Coat', price:400},{name:'Skirt', price:200},{name:'Blouse', price:200},{name:'Other'}] },
    { id: 'ironing',   name: 'Ironing Only',  unit: 'piece', icon: 'iron',    category: 'laundry',     tiers: { student: 30,  normal: 50,  corporate: 40 },   subtypes: [{name:'Shirt', price:50},{name:'Trouser', price:50},{name:'Dress', price:70},{name:'Suit', price:100},{name:'Linen', price:80},{name:'Other'}] },
    { id: 'shoe',      name: 'Shoe Washing',  unit: 'pair',  icon: 'shoe',    category: 'shoes',       tiers: { student: 250, normal: 350, corporate: 300 }, subtypes: [{name:'Sneakers', price:350},{name:'Leather', price:500},{name:'Boots', price:600},{name:'Sandals', price:250},{name:'Canvas', price:300},{name:'Suede', price:550},{name:'Other'}] },
    { id: 'duvet',     name: 'Duvet / Bedding', unit: 'piece', icon: 'duvet', category: 'laundry',     tiers: { student: 400, normal: 600, corporate: 500 }, subtypes: [{name:'Single', price:500},{name:'Double', price:600},{name:'Queen', price:700},{name:'King', price:800},{name:'Comforter', price:700},{name:'Blanket', price:400},{name:'Pillow', price:200},{name:'Bedsheet set', price:400},{name:'Other'}] },
    { id: 'curtain',   name: 'Curtains',      unit: 'piece', icon: 'curtain', category: 'laundry',     tiers: { student: 300, normal: 450, corporate: 380 } },
    { id: 'hanger',    name: 'Hanger',        unit: 'piece', icon: 'hanger',  category: 'supplies',    tiers: { student: 30,  normal: 30,  corporate: 30 } },
    { id: 'laundry-bag', name: 'Laundry Bag', unit: 'piece', icon: 'bag',     category: 'supplies',    tiers: { student: 150, normal: 150, corporate: 150 } },
    { id: 'dryclean-bag', name: 'Dry Cleaning Bag', unit: 'piece', icon: 'bag', category: 'supplies', tiers: { student: 0, normal: 0, corporate: 0 } },
  ];

  const expenseCategories = [
    { id: 'ec1', name: 'Detergent & supplies',  icon: 'box',    color: 'blue'   },
    { id: 'ec2', name: 'Outsourced dry cleaning', icon: 'dry',  color: 'violet' },
    { id: 'ec3', name: 'Electricity & water',   icon: 'alert',  color: 'amber'  },
    { id: 'ec4', name: 'Salaries & wages',      icon: 'staff',  color: 'green'  },
    { id: 'ec5', name: 'Rent',                  icon: 'box',    color: 'gray'   },
    { id: 'ec6', name: 'Equipment & repairs',   icon: 'wash',   color: 'red'    },
    { id: 'ec7', name: 'Transport & delivery',  icon: 'arrow',  color: 'blue'   },
    { id: 'ec8', name: 'Marketing',             icon: 'tag',    color: 'violet' },
    { id: 'ec9', name: 'Other',                 icon: 'package',color: 'gray'   },
  ];

  const expenses = [
    { id: 'ex1', date: '2026-05-27 09:10', category: 'ec1', label: 'Persil 5kg x 2 tubs',     amount: 2400, method: 'cash',  txn: '',          paidBy: 's1', notes: '' },
    { id: 'ex2', date: '2026-05-27 11:30', category: 'ec3', label: 'KPLC top-up',             amount: 5000, method: 'mpesa', txn: 'TGW8RR2102',paidBy: 's1', notes: 'May electricity' },
    { id: 'ex3', date: '2026-05-26 16:00', category: 'ec2', label: 'Sarova hotel suits (12)', amount: 2880, method: 'bank',  txn: 'BNK-998211',paidBy: 's2', notes: 'Outsourced' },
    { id: 'ex4', date: '2026-05-25 08:20', category: 'ec7', label: 'Boda boda fuel',          amount: 600,  method: 'cash',  txn: '',          paidBy: 's4', notes: '' },
    { id: 'ex5', date: '2026-05-24 14:15', category: 'ec6', label: 'Washer 2 belt repair',    amount: 3200, method: 'cash',  txn: '',          paidBy: 's2', notes: 'Service call-out' },
  ];

  const customers = [
    { id: 'c001', name: 'Achieng Otieno',     phone: '+254 712 445 901', group: 'normal',    joined: '2024-03-12', orders: 14, spend: 18420, loyalty: 6 },
    { id: 'c002', name: 'Brian Kamau',        phone: '+254 722 118 334', group: 'student',   joined: '2025-01-08', orders: 9,  spend: 6740,  loyalty: 4 },
    { id: 'c003', name: 'Sarova Stanley',     phone: '+254 700 000 421', group: 'corporate', joined: '2023-11-02', orders: 88, spend: 412300,loyalty: 12 },
    { id: 'c004', name: 'Wanjiku Mwangi',     phone: '+254 733 902 117', group: 'normal',    joined: '2025-06-22', orders: 3,  spend: 4220,  loyalty: 1 },
    { id: 'c005', name: 'Hassan Abdi',        phone: '+254 717 884 552', group: 'normal',    joined: '2025-04-19', orders: 7,  spend: 9120,  loyalty: 3 },
    { id: 'c006', name: 'Riverside Apartments', phone: '+254 705 442 010', group: 'corporate', joined: '2024-08-15', orders: 41, spend: 188500,loyalty: 8 },
    { id: 'c007', name: 'Faith Chebet',       phone: '+254 798 221 663', group: 'student',   joined: '2025-09-01', orders: 2,  spend: 1840,  loyalty: 0 },
    { id: 'c008', name: 'Peter Njoroge',      phone: '+254 723 551 088', group: 'normal',    joined: '2024-12-04', orders: 11, spend: 14700, loyalty: 5 },
    { id: 'c009', name: 'Mary Atieno',        phone: '+254 711 220 994', group: 'normal',    joined: '2025-02-14', orders: 6,  spend: 7300,  loyalty: 2 },
    { id: 'c010', name: 'Westgate Salon',     phone: '+254 706 110 220', group: 'corporate', joined: '2024-05-30', orders: 27, spend: 96400, loyalty: 7 },
  ];

  const staff = [
    { id: 's1', name: 'Grace Wairimu', role: 'Front Desk', shift: 'Morning', active: true },
    { id: 's2', name: 'David Otieno',  role: 'Washer',     shift: 'Morning', active: true },
    { id: 's3', name: 'Lucy Nyambura', role: 'Ironing',    shift: 'Morning', active: true },
    { id: 's4', name: 'Joseph Kimani', role: 'Rider',      shift: 'All-day', active: true },
    { id: 's5', name: 'Mercy Akinyi',  role: 'Front Desk', shift: 'Evening', active: false },
  ];

  const orders = [
    { id: 'SF-2418', customer: 'c001', items: [{ svc: 'wash-fold', qty: 4.5, price: 540 }, { svc: 'ironing', qty: 6, price: 300 }], total: 840, paid: 840, method: 'mpesa', txn: 'TGW8KL2M91', status: 'ready',    in: '2026-05-26 08:14', due: '2026-05-27 17:00', notes: 'Separate whites' },
    { id: 'SF-2419', customer: 'c003', items: [{ svc: 'wash-fold', qty: 32,  price: 3200 }, { svc: 'dry-clean', qty: 8, price: 1920 }], total: 5120, paid: 5120, method: 'bank',  txn: 'BNK-554210', status: 'washing',  in: '2026-05-26 09:30', due: '2026-05-28 12:00', notes: 'Hotel linens' },
    { id: 'SF-2420', customer: 'c002', items: [{ svc: 'dry-clean', qty: 2, price: 400 }], total: 400, paid: 0,    method: '—',     txn: '',           status: 'intake',   in: '2026-05-27 10:02', due: '2026-05-28 17:00', notes: '' },
    { id: 'SF-2421', customer: 'c004', items: [{ svc: 'wash-fold', qty: 3, price: 360 }, { svc: 'shoe', qty: 1, price: 350 }], total: 710, paid: 710, method: 'cash',  txn: '', status: 'ironing',  in: '2026-05-26 11:45', due: '2026-05-27 18:00', notes: 'Sneakers — gentle' },
    { id: 'SF-2422', customer: 'c006', items: [{ svc: 'wash-fold', qty: 48, price: 4800 }, { svc: 'duvet', qty: 4, price: 2000 }], total: 6800, paid: 3400, method: 'mpesa', txn: 'TGW9PQ44XK', status: 'washing',  in: '2026-05-27 07:50', due: '2026-05-29 10:00', notes: '50% deposit' },
    { id: 'SF-2423', customer: 'c005', items: [{ svc: 'ironing', qty: 12, price: 600 }], total: 600, paid: 600, method: 'mpesa', txn: 'TGW7HJ09ZZ', status: 'ready',    in: '2026-05-26 14:20', due: '2026-05-27 16:00', notes: '' },
    { id: 'SF-2424', customer: 'c008', items: [{ svc: 'wash-fold', qty: 6, price: 720 }], total: 720, paid: 720, method: 'cash',  txn: '', status: 'collected', in: '2026-05-25 09:00', due: '2026-05-26 17:00', notes: '' },
    { id: 'SF-2425', customer: 'c010', items: [{ svc: 'curtain', qty: 6, price: 2280 }], total: 2280, paid: 0,    method: '—',     txn: '',           status: 'intake',   in: '2026-05-27 11:15', due: '2026-05-30 12:00', notes: 'Heavy fabric' },
    { id: 'SF-2426', customer: 'c009', items: [{ svc: 'dry-clean', qty: 3, price: 840 }, { svc: 'ironing', qty: 4, price: 200 }], total: 1040, paid: 1040, method: 'mpesa', txn: 'TGW6BB2201', status: 'ironing',  in: '2026-05-27 08:30', due: '2026-05-28 17:00', notes: '' },
    { id: 'SF-2427', customer: 'c007', items: [{ svc: 'wash-fold', qty: 2.5, price: 200 }], total: 200, paid: 200, method: 'cash',  txn: '', status: 'washing',  in: '2026-05-27 09:10', due: '2026-05-28 17:00', notes: '' },
  ];

  // 14-day revenue trend (for sparkline + bars)
  const revenueTrend = [
    { d: '14 May', v: 8420 }, { d: '15 May', v: 11200 }, { d: '16 May', v: 9700 },
    { d: '17 May', v: 6300 }, { d: '18 May', v: 14200 }, { d: '19 May', v: 12800 },
    { d: '20 May', v: 15900 }, { d: '21 May', v: 10200 }, { d: '22 May', v: 13400 },
    { d: '23 May', v: 11800 }, { d: '24 May', v: 7900 },  { d: '25 May', v: 9100 },
    { d: '26 May', v: 16240 }, { d: '27 May', v: 12480 },
  ];

  const revenueByService = [
    { svc: 'wash-fold', label: 'Wash & Fold', value: 184300, pct: 46 },
    { svc: 'dry-clean', label: 'Dry Cleaning', value: 98200,  pct: 24 },
    { svc: 'ironing',   label: 'Ironing',     value: 42100,  pct: 10 },
    { svc: 'shoe',      label: 'Shoe Washing', value: 28400, pct: 7 },
    { svc: 'duvet',     label: 'Duvet/Bedding', value: 31200, pct: 8 },
    { svc: 'curtain',   label: 'Curtains',     value: 18900, pct: 5 },
  ];

  const revenueByMethod = [
    { m: 'mpesa', label: 'M-Pesa',   value: 248300, pct: 62, color: 'mpesa' },
    { m: 'cash',  label: 'Cash',     value: 96200,  pct: 24, color: 'cash' },
    { m: 'bank',  label: 'Bank',     value: 58600,  pct: 14, color: 'bank' },
  ];

  const payments = [
    { id: 'p1', date: '2026-05-27 10:42', order: 'SF-2422', customer: 'Riverside Apartments', method: 'mpesa', amount: 3400, txn: 'TGW9PQ44XK', verified: true },
    { id: 'p2', date: '2026-05-27 09:18', order: 'SF-2426', customer: 'Mary Atieno',         method: 'mpesa', amount: 1040, txn: 'TGW6BB2201', verified: true },
    { id: 'p3', date: '2026-05-27 09:10', order: 'SF-2427', customer: 'Faith Chebet',        method: 'cash',  amount: 200,  txn: '',           verified: true },
    { id: 'p4', date: '2026-05-26 16:30', order: 'SF-2419', customer: 'Sarova Stanley',      method: 'bank',  amount: 5120, txn: 'BNK-554210', verified: true },
    { id: 'p5', date: '2026-05-26 14:21', order: 'SF-2423', customer: 'Hassan Abdi',         method: 'mpesa', amount: 600,  txn: 'TGW7HJ09ZZ', verified: true },
    { id: 'p6', date: '2026-05-26 11:50', order: 'SF-2421', customer: 'Wanjiku Mwangi',      method: 'cash',  amount: 710,  txn: '',           verified: true },
    { id: 'p7', date: '2026-05-26 08:20', order: 'SF-2418', customer: 'Achieng Otieno',      method: 'mpesa', amount: 840,  txn: 'TGW8KL2M91', verified: false },
    { id: 'p8', date: '2026-05-25 15:11', order: 'SF-2424', customer: 'Peter Njoroge',       method: 'cash',  amount: 720,  txn: '',           verified: true },
  ];

  const packages = [
    { id: 'pk1', name: 'Student Monthly',    target: 'student',   period: 'month', price: 2800, includes: '20 kg wash & fold + 10 ironing', active: true, subscribers: 18 },
    { id: 'pk2', name: 'Family Weekly',      target: 'normal',    period: 'week',  price: 1500, includes: '8 kg wash & fold',                active: true, subscribers: 34 },
    { id: 'pk3', name: 'Office Pro',         target: 'corporate', period: 'month', price: 12000, includes: '40 pieces dry clean + ironing',  active: true, subscribers: 6 },
    { id: 'pk4', name: 'Hostel Bundle',      target: 'student',   period: 'month', price: 1900, includes: '15 kg wash & fold',               active: false, subscribers: 0 },
  ];

  const discounts = [
    { id: 'd1', name: 'New Customer 15%',  code: 'KARIBU15', value: 15, type: 'pct', expires: '2026-06-30', uses: 42 },
    { id: 'd2', name: 'Bulk over 30 kg',   code: 'BULK30',   value: 10, type: 'pct', expires: 'always',     uses: 18 },
    { id: 'd3', name: 'Loyalty 10th order',code: 'AUTO',     value: 500,type: 'flat',expires: 'always',     uses: 73 },
  ];

  const inventory = [
    { id: 'i1', item: 'Detergent (Persil 5kg)', stock: 12, reorder: 5, unit: 'tub' },
    { id: 'i2', item: 'Fabric softener',        stock: 4,  reorder: 6, unit: 'L'   },
    { id: 'i3', item: 'Hangers',                stock: 240,reorder: 100, unit: 'pc' },
    { id: 'i4', item: 'Garment tags',           stock: 38, reorder: 200, unit: 'pc' },
    { id: 'i5', item: 'Plastic covers',         stock: 410,reorder: 150, unit: 'pc' },
    { id: 'i6', item: 'Bleach',                 stock: 7,  reorder: 4,  unit: 'L' },
  ];

  const issues = [
    { id: 'is1', date: '2026-05-27 09:15', raisedBy: 'Grace Wairimu', subject: 'Customer says shirt color faded', priority: 'high',   status: 'open',       order: 'SF-2418' },
    { id: 'is2', date: '2026-05-26 14:02', raisedBy: 'David Otieno',  subject: 'Washing machine 2 making noise',  priority: 'medium', status: 'in-review',  order: '' },
    { id: 'is3', date: '2026-05-26 11:30', raisedBy: 'Lucy Nyambura', subject: 'Run out of fabric softener',      priority: 'medium', status: 'resolved',   order: '' },
    { id: 'is4', date: '2026-05-25 16:45', raisedBy: 'Joseph Kimani', subject: 'Delivery bike puncture repair',   priority: 'low',    status: 'resolved',   order: '' },
    { id: 'is5', date: '2026-05-25 09:20', raisedBy: 'Grace Wairimu', subject: 'M-Pesa code mismatch on SF-2410', priority: 'high',   status: 'open',       order: 'SF-2410' },
  ];

  return { services, customers, staff, orders, revenueTrend, revenueByService, revenueByMethod, payments, packages, discounts, inventory, issues, expenseCategories, expenses };
})();

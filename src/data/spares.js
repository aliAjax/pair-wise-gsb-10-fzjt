// 备件资料：型号目录与初始库存（与替换规则、页面分离）
// ports 为可用接口数量，用于判断能否接管故障设备的全部接线。
export const SPARE_CATALOG = [
  { id: 'RT-X100',  brand: 'NetGate',  name: '企业级路由器 X100',  category: 'router', ports: 4,  spec: '4×GE · NAT/VPN' },
  { id: 'RT-X200',  brand: 'NetGate',  name: '核心路由器 X200',    category: 'router', ports: 8,  spec: '8×GE · 双电源' },
  { id: 'SW-S24',   brand: 'LinkPro', name: '接入交换机 S24',      category: 'switch', ports: 24, spec: '24×GE · 二层' },
  { id: 'SW-S08',   brand: 'LinkPro', name: '桌面交换机 S08',      category: 'switch', ports: 8,  spec: '8×GE · 二层' },
  { id: 'SV-R210',  brand: 'ComputeX', name: '机架服务器 R210',    category: 'server', ports: 2,  spec: '2×GE · 1U 双路' },
  { id: 'EP-T50',   brand: 'DeskPro', name: '办公终端 T50',        category: 'device', ports: 1,  spec: '1×GE · 有线终端' },
];

export const INITIAL_STOCK = {
  'RT-X100': 1,
  'RT-X200': 0,
  'SW-S24': 2,
  'SW-S08': 1,
  'SV-R210': 1,
  'EP-T50': 3,
};

export const getModel = (id) => SPARE_CATALOG.find((m) => m.id === id) || null;

export const TYPE_LABELS = {
  router: '路由器',
  switch: '交换机',
  server: '服务器',
  device: '终端设备',
};

export const TYPE_ICONS = {
  router: '◉',
  switch: '▦',
  server: '▣',
  device: '▱',
};

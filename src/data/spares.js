// 备件资料：备用型号目录（含库存数量），与替换规则、持久化、页面解耦。
// 库存会被持久化层覆盖，这里只提供首次使用的初始资料。

export const TYPE_LABELS = {
  router: '路由器',
  switch: '交换机',
  server: '服务器',
  device: '终端设备',
};

// sku 唯一备件编号；type 要求与故障设备一致；ports 为可接管的接口数量
export const defaultSpares = [
  { sku: 'RT-NG-X4', maker: 'NetGate', model: 'NG-X4 企业路由器', type: 'router', ports: 4, stock: 2 },
  { sku: 'RT-NG-X2', maker: 'NetGate', model: 'NG-X2 接入路由器', type: 'router', ports: 2, stock: 1 },
  { sku: 'SW-L2-8', maker: 'Linea', model: 'L2-8 千兆交换机', type: 'switch', ports: 8, stock: 2 },
  { sku: 'SW-L2-4', maker: 'Linea', model: 'L2-4 桌面交换机', type: 'switch', ports: 4, stock: 1 },
  { sku: 'SV-R2U', maker: 'Forge', model: 'Rack 2U 服务器', type: 'server', ports: 2, stock: 1 },
  { sku: 'EP-T1', maker: 'Ubiq', model: 'T1 办公终端', type: 'device', ports: 1, stock: 3 },
];

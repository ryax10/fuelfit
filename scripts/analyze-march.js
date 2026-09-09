const ExcelJS = require('exceljs');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('C:/Users/Luch1/Downloads/FULLVAPO.xlsx');
  const ws = workbook.getWorksheet('SALIDAS DE STOCK');

  // Get all March 2026 sales
  const orders = {};
  ws.eachRow((row) => {
    const r = row.values.slice(1); // exceljs index starts at 1, slice removes leading undefined
    if (r[2] === '2026' && r[3] === 'Marzo') {
      const orderNum = r[0];
      const sku = r[5];
      const flavor = r[6];
      const qty = r[7];
      const customer = r[8];
      const cost = r[9];
      const totalCost = r[10];
      const salePrice = r[11];
      const totalSale = r[12];

      if (!orders[orderNum]) orders[orderNum] = { customer, items: [], totalCost: 0, totalSale: 0, dateSerial: r[1] };
      orders[orderNum].items.push({ sku, flavor, qty, cost, totalCost, salePrice, totalSale });
      orders[orderNum].totalCost += (totalCost || 0);
      orders[orderNum].totalSale += (totalSale || 0);
    }
  });

  Object.entries(orders).forEach(([num, ord]) => {
    console.log(num, ord.customer, 'total_sale:', ord.totalSale.toFixed(2), 'total_cost:', ord.totalCost.toFixed(2), 'items:', ord.items.length, 'date_serial:', ord.dateSerial);
  });
  console.log('\nTotal orders:', Object.keys(orders).length);
  const totalSale = Object.values(orders).reduce((sum, o) => sum + o.totalSale, 0);
  const totalCost = Object.values(orders).reduce((sum, o) => sum + o.totalCost, 0);
  console.log('Total sales USD:', totalSale.toFixed(2));
  console.log('Total COGS USD:', totalCost.toFixed(2));
}

main().catch(console.error);

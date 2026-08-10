const generatePrintingOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const monthNumber = date.getMonth() + 1;
  const randomDigit = Math.floor(10000 + Math.random() * 90000);
  return `CPR-${year}-${monthNumber.toString().padStart(2, "0")}-${randomDigit}`;
};

export default generatePrintingOrderNumber;

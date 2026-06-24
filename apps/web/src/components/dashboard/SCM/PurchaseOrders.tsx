export default function PurchaseOrders() {
  return (
    <div style={{padding: "25px",
    backgroundColor: "white",
    minHeight: "100vh",
    width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "42px", fontWeight: "bold" ,color:"black"}}>
          Purchase Orders
        </h1>

        <button
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 20px",
          }}
        >
          Create PO
        </button>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>PO Number</th>
              <th style={{ padding: "16px", textAlign: "left" ,color:"black"}}>Vendor</th>
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>Amount</th>
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={{ padding: "16px" }}>PO-001</td>
              <td style={{ padding: "16px" }}>ABC Suppliers</td>
              <td style={{ padding: "16px" }}>₹50,000</td>
              <td style={{ padding: "16px", color: "green" }}>Approved</td>
            </tr>

            <tr>
              <td style={{ padding: "16px" }}>PO-002</td>
              <td style={{ padding: "16px" }}>XYZ Traders</td>
              <td style={{ padding: "16px" }}>₹80,000</td>
              <td style={{ padding: "16px", color: "#d97706" }}>Pending</td>
            </tr>

            <tr>
              <td style={{ padding: "16px" }}>PO-003</td>
              <td style={{ padding: "16px" }}>Tech Vendor</td>
              <td style={{ padding: "16px" }}>₹25,000</td>
              <td style={{ padding: "16px", color: "red" }}>Rejected</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
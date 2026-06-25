export default function Vendors() {
  return (
    <div style={{ padding: "25px",
    backgroundColor: "white",
    minHeight: "100vh",
    width: "100%"}}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "42px", fontWeight: "bold",color:"black" }}>
          Vendors
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
          Add Vendor
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
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>Vendor ID</th>
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>Vendor Name</th>
              <th style={{ padding: "16px", textAlign: "left",color:"black" }}>City</th>
              <th style={{ padding: "16px", textAlign: "left" ,color:"black"}}>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={{ padding: "16px" }}>V001</td>
              <td style={{ padding: "16px" }}>ABC Suppliers</td>
              <td style={{ padding: "16px" }}>Pune</td>
              <td style={{ padding: "16px", color: "green" }}>Active</td>
            </tr>

            <tr>
              <td style={{ padding: "16px" }}>V002</td>
              <td style={{ padding: "16px" }}>XYZ Traders</td>
              <td style={{ padding: "16px" }}>Mumbai</td>
              <td style={{ padding: "16px", color: "green" }}>Active</td>
            </tr>

            <tr>
              <td style={{ padding: "16px" }}>V003</td>
              <td style={{ padding: "16px" }}>Tech Vendor</td>
              <td style={{ padding: "16px" }}>Nagpur</td>
              <td style={{ padding: "16px", color: "red" }}>Inactive</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
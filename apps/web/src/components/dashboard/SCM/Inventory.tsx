export default function Inventory() {
 return (
  <div style={{ padding: "25px",
    backgroundColor: "white",
    minHeight: "100vh",
    width: "100%"}}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
      }}
    >
      <h1 style={{ fontSize: "42px", fontWeight: "bold" , color:"black"}}>
        Inventory
      </h1>

      <button
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 20px",
          cursor: "pointer",
        }}
      >
        Add Item
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
        <thead
          style={{
            background: "#f1f5f9",
          }}
        >
          <tr>
            <th style={{ padding: "16px", textAlign: "left",color: "black" }}>
              Item Code
            </th>
            <th style={{ padding: "16px", textAlign: "left",color: "black" }}>
              Item Name
            </th>
            <th style={{ padding: "16px", textAlign: "left",color: "black"  }}>
              Stock
            </th>
            <th style={{ padding: "16px", textAlign: "left" ,color: "black" }}>
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={{ padding: "16px" }}>ITM-001</td>
            <td style={{ padding: "16px" }}>Laptop</td>
            <td style={{ padding: "16px" }}>120</td>
            <td style={{ padding: "16px", color: "green" }}>
              Available
            </td>
          </tr>

          <tr>
            <td style={{ padding: "16px" }}>ITM-002</td>
            <td style={{ padding: "16px" }}>Keyboard</td>
            <td style={{ padding: "16px" }}>8</td>
            <td style={{ padding: "16px", color: "#d97706" }}>
              Low Stock
            </td>
          </tr>

          <tr>
            <td style={{ padding: "16px" }}>ITM-003</td>
            <td style={{ padding: "16px" }}>Mouse</td>
            <td style={{ padding: "16px" }}>0</td>
            <td style={{ padding: "16px", color: "red" }}>
              Out Of Stock
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);
}
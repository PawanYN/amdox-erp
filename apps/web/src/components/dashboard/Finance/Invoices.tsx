"use client";

import { useMemo, useState } from "react";

type Invoice = {
  id: string;
  party: string;
  amount: string;
  date: string;
  status: string;
};

export default function Invoices() {
  const [tab, setTab] = useState<"Payable"|"Receivable">("Payable");

  const [payable, setPayable] = useState<Invoice[]>([
    { id:"AP-001", party:"ABC Suppliers", amount:"₹45,000", date:"2026-06-20", status:"Matched"},
    { id:"AP-002", party:"XYZ Traders", amount:"₹80,000", date:"2026-06-21", status:"Pending"},
  ]);

  const [receivable, setReceivable] = useState<Invoice[]>([
    { id:"AR-001", party:"Tech Corp", amount:"₹1,20,000", date:"2026-06-18", status:"Paid"},
    { id:"AR-002", party:"Future Pvt Ltd", amount:"₹95,000", date:"2026-06-19", status:"Open"},
  ]);

  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [form,setForm]=useState({party:"",amount:"",date:"",status:""});

  const list = useMemo(()=>{
    const src = tab==="Payable"?payable:receivable;
    return src.filter(i=>(i.id+i.party+i.status).toLowerCase().includes(search.toLowerCase()));
  },[tab,payable,receivable,search]);

  const badge=(s:string)=>{
    if(["Matched","Paid"].includes(s)) return "bg-green-100 text-green-700";
    if(["Mismatch","Overdue"].includes(s)) return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  }

  function save(){
    if(!form.party||!form.amount||!form.date||!form.status){alert("Fill all fields");return;}
    const obj:Invoice={
      id: tab==="Payable"?`AP-${String(payable.length+1).padStart(3,"0")}`:`AR-${String(receivable.length+1).padStart(3,"0")}`,
      party:form.party,
      amount:`₹${Number(form.amount).toLocaleString("en-IN")}`,
      date:form.date,
      status:form.status
    };
    if(tab==="Payable") setPayable([...payable,obj]); else setReceivable([...receivable,obj]);
    setForm({party:"",amount:"",date:"",status:""});
    setOpen(false);
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {open&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-[500px]">
            <h2 className="text-2xl font-bold mb-4">New Invoice</h2>
            <div className="space-y-3">
              <input className="w-full border p-3 rounded" placeholder={tab==="Payable"?"Vendor":"Customer"} value={form.party} onChange={e=>setForm({...form,party:e.target.value})}/>
              <input className="w-full border p-3 rounded" type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/>
              <input className="w-full border p-3 rounded" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
              <input className="w-full border p-3 rounded" placeholder="Status" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}/>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={()=>setOpen(false)} className="border px-4 py-2 rounded">Cancel</button>
              <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invoices (AP / AR)</h1>
        <button onClick={()=>setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded">+ New Invoice</button>
      </div>

      <div className="flex gap-3 mb-4">
        <button onClick={()=>setTab("Payable")} className={`px-4 py-2 rounded ${tab==="Payable"?"bg-blue-600 text-white":"border bg-white"}`}>Payable</button>
        <button onClick={()=>setTab("Receivable")} className={`px-4 py-2 rounded ${tab==="Receivable"?"bg-blue-600 text-white":"border bg-white"}`}>Receivable</button>
        <input className="ml-auto border rounded p-2 w-64" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Invoice ID</th>
              <th className="p-3 text-left">{tab==="Payable"?"Vendor":"Customer"}</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map(i=>(
              <tr key={i.id} className="border-t">
                <td className="p-3">{i.id}</td>
                <td className="p-3">{i.party}</td>
                <td className="p-3">{i.amount}</td>
                <td className="p-3">{i.date}</td>
                <td className="p-3"><span className={`px-3 py-1 rounded-full text-sm ${badge(i.status)}`}>{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

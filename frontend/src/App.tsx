import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* All routes lead to the chat - it IS the app */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

"use client";

import AlgoforgeDashboard from "@/components/DashBoard/DashBoard";
import { DashboardGate } from "@/components/DashBoard/DashboardGate";

export default function DashboardPage() {
    return (
        <DashboardGate>
            <AlgoforgeDashboard />
        </DashboardGate>
    );
}
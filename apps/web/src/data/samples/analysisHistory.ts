import type { AnalysisHistoryItem, AnalysisHistoryMeta } from "@/components/DashBoard/analysis-history";

export const SAMPLE_HISTORY: AnalysisHistoryItem[] = [
    { id: "1", language: "javascript", complexity: "O(n)", suggestion: "Use hashmap to reduce lookup time", createdAt: "2026-05-04T10:15:30Z" },
    { id: "2", language: "python", complexity: "O(n log n)", suggestion: "Optimize sorting using parallel streams", createdAt: "2026-05-04T12:20:10Z" },
    { id: "3", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "4", language: "javascript", complexity: null, suggestion: "Avoid nested loops; try map/filter", createdAt: "2026-05-04T16:40:00Z" },
    { id: "5", language: "python", complexity: "O(log n)", suggestion: null, createdAt: "2026-05-04T18:55:12Z" },
    { id: "6", language: "javascript", complexity: "O(n)", suggestion: "Use hashmap to reduce lookup time", createdAt: "2026-05-04T10:15:30Z" },
    { id: "7", language: "python", complexity: "O(n log n)", suggestion: "Optimize sorting using parallel streams", createdAt: "2026-05-04T12:20:10Z" },
    { id: "8", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "9", language: "javascript", complexity: null, suggestion: "Avoid nested loops; try map/filter", createdAt: "2026-05-04T16:40:00Z" },
    { id: "10", language: "python", complexity: "O(log n)", suggestion: null, createdAt: "2026-05-04T18:55:12Z" },
    { id: "11", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "12", language: "javascript", complexity: "O(n)", suggestion: "Use hashmap to reduce lookup time", createdAt: "2026-05-04T10:15:30Z" },
    { id: "13", language: "python", complexity: "O(n log n)", suggestion: "Optimize sorting using parallel streams", createdAt: "2026-05-04T12:20:10Z" },
    { id: "14", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "15", language: "javascript", complexity: null, suggestion: "Avoid nested loops; try map/filter", createdAt: "2026-05-04T16:40:00Z" },
    { id: "16", language: "python", complexity: "O(log n)", suggestion: null, createdAt: "2026-05-04T18:55:12Z" },
    { id: "17", language: "javascript", complexity: "O(n)", suggestion: "Use hashmap to reduce lookup time", createdAt: "2026-05-04T10:15:30Z" },
    { id: "18", language: "python", complexity: "O(n log n)", suggestion: "Optimize sorting using parallel streams", createdAt: "2026-05-04T12:20:10Z" },
    { id: "19", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "20", language: "javascript", complexity: null, suggestion: "Avoid nested loops; try map/filter", createdAt: "2026-05-04T16:40:00Z" },
    { id: "21", language: "python", complexity: "O(log n)", suggestion: null, createdAt: "2026-05-04T18:55:12Z" },
    { id: "22", language: "javascript", complexity: "O(n)", suggestion: "Use hashmap to reduce lookup time", createdAt: "2026-05-04T10:15:30Z" },
    { id: "23", language: "python", complexity: "O(n log n)", suggestion: "Optimize sorting using parallel streams", createdAt: "2026-05-04T12:20:10Z" },
    { id: "24", language: "python", complexity: "O(n^2)", suggestion: "Consider using dynamic programming", createdAt: "2026-05-04T14:05:45Z" },
    { id: "25", language: "javascript", complexity: null, suggestion: "Avoid nested loops; try map/filter", createdAt: "2026-05-04T16:40:00Z" },
    { id: "26", language: "python", complexity: "O(log n)", suggestion: null, createdAt: "2026-05-04T18:55:12Z" },
    
];
export const SAMPLE_META: AnalysisHistoryMeta = { nextCursor: null, hasMore: false };

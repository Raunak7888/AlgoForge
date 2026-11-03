// Shared types for the algorithm service modules.

export type AlgorithmQuery = {
  categoryId?:  string;
  difficulty?:  string;
  isPublished?: boolean;
  search?:      string;
};

/** Who is asking. Non-admins can only ever see published algorithms. */
export type AlgorithmVisibility = {
  isAdmin: boolean;
};

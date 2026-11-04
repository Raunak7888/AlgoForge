// Shared types for the algorithm service modules.

export type AlgorithmQuery = {
  categoryId?: string;
  difficulty?: string;
  isPublished?: boolean;
  /** Matches name, description and tag labels. */
  search?: string;
  tag?: string;
  limit: number;
  /** Id of the last row of the previous page. */
  cursor?: string;
};

/** Who is asking. Non-admins can only ever see published algorithms. */
export type AlgorithmVisibility = {
  isAdmin: boolean;
};

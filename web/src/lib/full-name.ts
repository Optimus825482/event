/** Ad ve soyadı birleştirir: kenar boşlukları kırpılır, boş parçalar atılır, parçalar tek boşlukla bağlanır. */
export function joinFullName(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "")
    .join(" ");
}

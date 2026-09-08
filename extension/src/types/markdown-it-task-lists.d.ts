// markdown-it-task-lists ships no types and has no @types package. This is the
// slice of its surface the parser actually uses: a standard markdown-it plugin
// taking one options object.
declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  interface TaskListsOptions {
    /** Wrap each item's text in a <label> so the checkbox is clickable. */
    label?: boolean;
    /** Put the label after the checkbox rather than around the whole item. */
    labelAfter?: boolean;
    /** Leave the checkboxes interactive instead of disabling them. */
    enabled?: boolean;
  }

  const taskLists: MarkdownIt.PluginWithOptions<TaskListsOptions>;
  export default taskLists;
}

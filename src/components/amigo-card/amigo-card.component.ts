import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'amigo-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './amigo-card.component.html'
})
export class AmigoCardComponent {
  @Input() field!: any;

  cardIcon(): string {
    return this.field?.card?.icon || "";
  }

  cardTitle(): string {
    return this.field?.card?.title || this.field?.label || "Info";
  }

  cardBody(): string {
    return this.field?.card?.body || "";
  }

  cardStyle(): Record<string, any> {
    const cs = this.field?.card?.style ?? {};
    const borderWidth = cs.borderWidth ?? 1;
    const borderRadius = cs.borderRadius ?? 12;
    const borderColor = cs.borderColor ?? "#BBF7D0";
    const backgroundColor = cs.backgroundColor ?? "#F0FDF4";
    const textColor = cs.textColor ?? "#166534";

    return {
      borderStyle: "solid",
      borderWidth: `${borderWidth}px`,
      borderColor,
      borderRadius: `${borderRadius}px`,
      backgroundColor,
      color: textColor,
      padding: "12px",
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
    };
  }

  cardIconStyle(): Record<string, any> {
    const cs = this.field?.card?.style ?? {};
    const textColor = cs.textColor ?? "#166534";
    return {
      color: cs.iconColor ?? textColor,
      fontSize: "18px",
      lineHeight: "1",
      marginTop: "2px",
    };
  }

  isBootstrapIcon(icon: string | null | undefined): boolean {
    const v = (icon || "").trim();
    return v.startsWith("bi ") || v.startsWith("bi-") || v.includes(" bi-");
  }
}

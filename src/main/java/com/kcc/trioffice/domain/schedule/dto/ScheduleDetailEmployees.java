package com.kcc.trioffice.domain.schedule.dto;

import lombok.Data;

@Data
public class ScheduleDetailEmployees {
  private Long employeeId;
  private String employeeName;
  private String deptName;
  private String isParticipated;

}
